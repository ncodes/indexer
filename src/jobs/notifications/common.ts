import NotificationSetting from '../../models/notification_setting';
import User from '../../models/user';

export enum NotificationID {
  PutApproved = 'PutApproved',
  PutRevoked = 'PutRevoked',
  SwapApproved = 'SwapApproved',
  SwapRevoked = 'SwapRevoked',

  UpdatedLiquidityManager = 'UpdatedLiquidityManager',
  RemoveLiquidityManager = 'RemoveLiquidityManager',

  NewInstantSwap = 'NewInstantSwap',
  NewInteractiveSwap = 'NewInteractiveSwap',
  SwapOrderReleased = 'SwapOrderReleased',
  SwapOrderCancelled = 'SwapOrderCancelled',
  SwapOrderPaid = 'SwapOrderPaid',

  TicketSlashed = 'TicketSlashed',
  TicketDrafted = 'TicketDrafted',
  DisputeCreated = 'DisputeCreated',
  FullyDrafted = 'FullyDrafted',
  EvidencePhaseStarted = 'EvidencePhaseStarted',
  EvidencePhaseEnded = 'EvidencePhaseEnded',
  CommitPhaseEnded = 'CommitPhaseEnded',
  RevealPhaseEnded = 'RevealPhaseEnded',
  DisputeExecuted = 'DisputeExecuted',

  NewOffer = 'NewOffer',
  OfferUpdated = 'OfferUpdated',
  OfferAccepted = 'OfferAccepted',
  OfferCancelled = 'OfferCancelled',
  OfferUnaccepted = 'OfferUnaccepted',
  OfferExecuted = 'OfferExecuted',

  ChatNewMessage = 'ChatNewMessage',
  VerifyNewEmail = 'VerifyNewEmail',
}

/**
 * Check if user can receive a type of notifications or none at all
 * @param user The user object
 * @param notifId The notification ID
 * @returns
 */
export function canSendNotification(user: Partial<User>, notifId: NotificationID) {
  const alwaysEnabledNotifIds = [NotificationID.VerifyNewEmail];
  const notifSettings = user.notificationSettings || new NotificationSetting();
  if (notifSettings.disabled && !alwaysEnabledNotifIds.includes(notifId)) return false;

  const offerNotifIds = [
    NotificationID.NewOffer,
    NotificationID.OfferAccepted,
    NotificationID.OfferUnaccepted,
    NotificationID.OfferExecuted,
    NotificationID.OfferCancelled,
    NotificationID.OfferUpdated,
  ];
  if (notifSettings.disabledOffer && offerNotifIds.includes(notifId)) {
    return false;
  }

  const swapNotifIds = [
    NotificationID.SwapOrderPaid,
    NotificationID.SwapOrderReleased,
    NotificationID.SwapOrderCancelled,
    NotificationID.DisputeCreated,
    NotificationID.FullyDrafted,
    NotificationID.EvidencePhaseStarted,
    NotificationID.EvidencePhaseEnded,
    NotificationID.CommitPhaseEnded,
    NotificationID.RevealPhaseEnded,
    NotificationID.DisputeExecuted,
  ];
  if (notifSettings.disabledSwap && swapNotifIds.includes(notifId)) {
    return false;
  }

  const liqNotifIds = [NotificationID.NewInstantSwap, NotificationID.NewInteractiveSwap];
  if (notifSettings.disabledLiq && liqNotifIds.includes(notifId)) {
    return false;
  }

  return true;
}
