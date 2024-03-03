import axios from 'axios';
import { GetPurchaseDataOptions } from './types/get-purchase-data.options';
import { PurchaseDataResponse } from './types/purchase-data.response';

const errorMap: Record<number, string> = {
  21000: 'The App Store could not read the JSON object you provided.',
  21002: 'The data in the receipt-data property was malformed.',
  21003: 'The receipt could not be authenticated.',
  21004: 'The shared secret you provided does not match the shared secret on file for your account.',
  21005: 'The receipt server is not currently available.',
  21006:
    'This receipt is valid but the subscription has expired. When this status code is returned to your server, the receipt data is also decoded and returned as part of the response.',
  21007: 'This receipt is a sandbox receipt, but it was sent to the production service for verification.',
  21008: 'This receipt is a production receipt, but it was sent to the sandbox service for verification.',
  2: 'The receipt is valid, but purchased nothing.',
};

const REC_KEYS = {
  IN_APP: 'in_app',
  LRI: 'latest_receipt_info',
  BUNDLE_ID: 'bundle_id',
  BID: 'bid',
  TRANSACTION_ID: 'transaction_id',
  ORIGINAL_TRANSACTION_ID: 'original_transaction_id',
  PRODUCT_ID: 'product_id',
  ITEM_ID: 'item_id',
  ORIGINAL_PURCHASE_DATE_MS: 'original_purchase_date_ms',
  EXPIRES_DATE_MS: 'expires_date_ms',
  EXPIRES_DATE: 'expires_date',
  EXPIRATION_DATE: 'expiration_date',
  EXPIRATION_INTENT: 'expiration_intent',
  CANCELLATION_DATE: 'cancellation_date',
  PURCHASE_DATE_MS: 'purchase_date_ms',
  IS_TRIAL: 'is_trial_period',
};

const LIVE_HOST = 'buy.itunes.apple.com';
const PATH = '/verifyReceipt';
let applePassword: string;

export function init(password: string) {
  applePassword = password;
}

export async function validatePurchase(receipt: string, secret?: string) {
  const prodPath = 'https://' + LIVE_HOST + PATH;
  let validatedData;

  const content: any = { 'receipt-data': receipt };

  if (applePassword) {
    content.password = applePassword;
  }

  // override applePassword from config to allow dynamically fed secret to validate
  if (secret) {
    content.password = secret;
  }

  const response = await axios.post(prodPath, content);
  const status: number = response.data?.status ?? 404;

  if (response.status !== 200) {
    return {
      sandbox: false,
      status: response.status,
      message: errorMap[status] || 'Unknown',
    };
  }

  // apple responded with error
  if (response.data.status > 0) {
    if (response.data.status === 21006 && !isExpired(response.data)) {
      /* valid subscription receipt,
        but cancelled and it has not been expired
        status code is 21006 for both expired receipt and cancelled receipt...
      */
      validatedData = response.data;
      validatedData.sandbox = false;
      // force status to be 0
      validatedData.status = 0;
      return validatedData;
    }

    validatedData = {
      sandbox: false,
      status: response.data.status,
      message: errorMap[status] || 'Unknown',
    };
    return validatedData;
  }
  // production validated
  validatedData = response.data;
  validatedData.sandbox = false;
  return validatedData;
}

export function getPurchaseData(purchase: any, options: GetPurchaseDataOptions): PurchaseDataResponse[] {
  if (!purchase || !purchase.receipt) {
    return [];
  }
  const data: PurchaseDataResponse[] = [];
  if (purchase.receipt[REC_KEYS.IN_APP]) {
    // iOS 6+
    const now = Date.now();
    const tids = [];
    let list = purchase.receipt[REC_KEYS.IN_APP];
    const lri = purchase[REC_KEYS.LRI] || purchase.receipt[REC_KEYS.LRI];
    if (lri && Array.isArray(lri)) {
      list = list.concat(lri);
    }
    /*
      we sort list by purchase_date_ms to make it easier
      to weed out duplicates (items with the same original_transaction_id)
      purchase_date_ms DESC
      */
    list.sort(function (a: any, b: any) {
      return parseInt(b[REC_KEYS.PURCHASE_DATE_MS], 10) - parseInt(a[REC_KEYS.PURCHASE_DATE_MS], 10);
    });
    for (let i = 0, len = list.length; i < len; i++) {
      const item = list[i];
      const tid = item['original_' + REC_KEYS.TRANSACTION_ID];
      const exp = getSubscriptionExpireDate(item);

      if (
        options &&
        options.ignoreCanceled &&
        item[REC_KEYS.CANCELLATION_DATE] &&
        item[REC_KEYS.CANCELLATION_DATE].length &&
        /* if a subscription has been cancelled,
              we need to check if the receipt has expired or not...
              if it is not subscription (exp is 0 in that case), we ignore right away...
              */
        (!exp || now - exp >= 0)
      ) {
        continue;
      }

      if (options && options.ignoreExpired && exp && now - exp >= 0) {
        // we are told to ignore expired item and it is expired
        continue;
      }
      if (tids.indexOf(tid) > -1) {
        /* avoid duplicate and keep the latest
              there are cases where we could have
              the same "time" so we evaludate <= instead of < alone */
        continue;
      }

      tids.push(tid);
      const parsed: any = parseResponse(item);
      // transaction ID should be a string:
      // https://developer.apple.com/documentation/storekit/skpaymenttransaction/1411288-transactionidentifier
      parsed.transactionId = parsed.transactionId.toString();
      // originalTransactionId should also be a string
      if (parsed.originalTransactionId && !isNaN(parsed.originalTransactionId)) {
        parsed.originalTransactionId = parsed.originalTransactionId.toString();
      }

      // we need to stick to the name isTrial
      if (parsed.isTrialPeriod != undefined) {
        parsed.isTrial = Boolean(parsed.isTrialPeriod);
      } else {
        parsed.isTrial = false;
      }

      parsed.bundleId = purchase.receipt[REC_KEYS.BUNDLE_ID] || purchase.receipt[REC_KEYS.BID];
      parsed.expirationDate = exp;
      data.push(parsed);
    }
    return data;
  }
  // old and will be deprecated by Apple
  const receipt = purchase[REC_KEYS.LRI] || purchase.receipt;
  data.push({
    bundleId: receipt[REC_KEYS.BUNDLE_ID] || receipt[REC_KEYS.BID],
    appItemId: receipt[REC_KEYS.ITEM_ID],
    originalTransactionId: receipt[REC_KEYS.ORIGINAL_TRANSACTION_ID],
    transactionId: receipt[REC_KEYS.TRANSACTION_ID],
    productId: receipt[REC_KEYS.PRODUCT_ID],
    originalPurchaseDate: receipt[REC_KEYS.ORIGINAL_PURCHASE_DATE_MS],
    purchaseDate: receipt[REC_KEYS.PURCHASE_DATE_MS],
    quantity: parseInt(receipt.quantity, 10),
    expirationDate: getSubscriptionExpireDate(receipt),
    isTrial: Boolean(receipt[REC_KEYS.IS_TRIAL]),
    cancellationDate: receipt[REC_KEYS.CANCELLATION_DATE] || 0,
  });
  return data;
}

function getSubscriptionExpireDate(data: any) {
  if (!data) {
    return 0;
  }
  if (data[REC_KEYS.EXPIRES_DATE_MS]) {
    return parseInt(data[REC_KEYS.EXPIRES_DATE_MS], 10);
  }
  if (data[REC_KEYS.EXPIRES_DATE]) {
    return data[REC_KEYS.EXPIRES_DATE];
  }
  if (data[REC_KEYS.EXPIRATION_DATE]) {
    return data[REC_KEYS.EXPIRATION_DATE];
  }
  if (data[REC_KEYS.EXPIRATION_INTENT]) {
    return parseInt(data[REC_KEYS.EXPIRATION_INTENT], 10);
  }
  return 0;
}

function isExpired(responseData: any) {
  if (responseData[REC_KEYS.LRI] && responseData[REC_KEYS.LRI][REC_KEYS.EXPIRES_DATE]) {
    const exp = parseInt(responseData[REC_KEYS.LRI][REC_KEYS.EXPIRES_DATE]);
    if (exp > Date.now()) {
      return true;
    }
    return false;
  }
}

function parseResponse(response: any) {
  const res: any = {};
  for (const key in response) {
    const val = response[key];
    const name = toCamelCase(key);
    if (!isNaN(val) && typeof val !== 'boolean') {
      res[name] = parseFloat(val);
    } else {
      res[name] = val;
    }
  }
  return res;
}

function toCamelCase(str: string) {
  const list = str.split('_');
  let res = '';
  for (let i = 0, len = list.length; i < len; i++) {
    res += (i === 0 ? list[i][0] : list[i][0].toUpperCase()) + list[i].substring(1);
  }
  return res;
}
