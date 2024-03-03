export interface PurchaseDataResponse {
  quantity: number;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  purchaseDate: string;
  isTrial: boolean;
  bundleId: string;
  expirationDate: number;
  purchaseDateMs?: number;
  purchaseDatePst?: string;
  originalPurchaseDate?: string;
  originalPurchaseDateMs?: number;
  originalPurchaseDatePst?: string;
  isTrialPeriod?: string;
  inAppOwnershipType?: string;
  appItemId?: string;
  cancellationDate?: string;
}
