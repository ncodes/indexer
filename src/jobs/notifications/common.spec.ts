import User from '../../models/user';
import { NotificationID, canSendNotification } from './common';

describe('canSendNotification', () => {
  it('should return true if notification settings are not disabled', () => {
    const user: Partial<User> = {
      notificationSettings: {
        disabled: false,
      },
    };
    const notifId: NotificationID = NotificationID.NewOffer;
    const result = canSendNotification(user, notifId);
    expect(result).toBeTruthy();
  });

  it('should return false if notification settings are disabled', () => {
    const user: Partial<User> = {
      notificationSettings: {
        disabled: true,
      },
    };
    const notifId: NotificationID = NotificationID.NewOffer;
    const result = canSendNotification(user, notifId);
    expect(result).toBeFalsy();
  });

  it('should return true if notification settings are disabled but notifId is part of the always enabled list', () => {
    const user: Partial<User> = {
      notificationSettings: {
        disabled: true,
      },
    };
    const notifId: NotificationID = NotificationID.VerifyNewEmail;
    const result = canSendNotification(user, notifId);
    expect(result).toBeTruthy();
  });

  it('should return false if offer notifications are disabled and notifId is in offerNotifIds', () => {
    const user: Partial<User> = {
      notificationSettings: {
        disabled: false,
        disabledOffer: true,
      },
    };
    const notifId: NotificationID = NotificationID.NewOffer;
    const result = canSendNotification(user, notifId);
    expect(result).toBeFalsy();
  });

  it('should return false if swap notifications are disabled and notifId is in swapNotifIds', () => {
    const user: Partial<User> = {
      notificationSettings: {
        disabled: false,
        disabledSwap: true,
      },
    };
    const notifId: NotificationID = NotificationID.SwapOrderPaid;
    const result = canSendNotification(user, notifId);
    expect(result).toBeFalsy();
  });

  it('should return false if liquidity notifications are disabled and notifId is in liqNotifIds', () => {
    const user: Partial<User> = {
      notificationSettings: {
        disabled: false,
        disabledLiq: true,
      },
    };
    const notifId: NotificationID = NotificationID.NewInstantSwap;
    const result = canSendNotification(user, notifId);
    expect(result).toBeFalsy();
  });
});
