## Overview

This is library to verify the receipt of apple (itunes) purchase, get the purchased items, and consuming it in [node.js][node] backend server.

## Installation

```bash
npm install apple-receipt-verifier --save
```

## Usage

```js
var verifier = require('apple-receipt-verifier');

// receipt from client.
// Reference:  https://developer.apple.com/documentation/storekit/in-app_purchase/original_api_for_in-app_purchase/validating_receipts_with_the_app_store

var receipt = 'YourApplePurchaseReceiptGoesHere';
var appleSecret = 'YourAppleSecretGoesHere';

verifier.init(appleSecret);
var validatedData = await verifier.validatePurchase(receipt);

var options = {
  ignoreCanceled: true, // purchaseData will NOT contain canceled items
  ignoreExpired: true, // purchaseData will NOT contain expired subscription items
};

var purchaseData = await verifier.getPurchaseData(validatedData, options);
```

```ts
import { init, validatePurchase, getPurchaseData } from 'apple-receipt-verifier';

// receipt from client.
// Reference:  https://developer.apple.com/documentation/storekit/in-app_purchase/original_api_for_in-app_purchase/validating_receipts_with_the_app_store

const receipt = 'YourApplePurchaseReceiptGoesHere';
const appleSecret = 'YourAppleSecretGoesHere';

init(appleSecret);
const validatedData = await validatePurchase(receipt);

const options = {
  ignoreCanceled: true, // purchaseData will NOT contain canceled items
  ignoreExpired: true, // purchaseData will NOT contain expired subscription items
};

const purchaseData = await getPurchaseData(validatedData, options);
```

## Tests

```bash
npm test
```

## Contributing

Take care to maintain the existing coding style.
Add unit tests for any new or changed functionality. Lint and test your code.

## Inspired by

- apple's api document - // receipt from client.
  // Reference: https://developer.apple.com/documentation/storekit/in-app_purchase/original_api_for_in-app_purchase/validating_receipts_with_the_app_store

## Release History

- 1.0.0 Initial release

[node]: http://nodejs.org/
