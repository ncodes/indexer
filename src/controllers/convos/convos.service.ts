import { createPromiseClient } from '@connectrpc/connect';
import { createConnectTransport } from '@connectrpc/connect-node';
import { Injectable } from '@nestjs/common';
import { Notifications } from '../notifications/proto/service_connect';

@Injectable()
export default class ConvosService {
  // Get the client
  private getClient() {
    return createPromiseClient(
      Notifications,
      createConnectTransport({
        httpVersion: '1.1',
        baseUrl: process.env.NOTIFICATION_SERVER_URL,
      }),
    );
  }

  /**
   * Register a device token
   * @param installationId The installation ID
   * @param deviceType The device type
   * @param deviceToken The device token
   */
  async registerInstallation(installationId: string, deviceType: 'email', deviceToken: string) {
    const client = this.getClient();
    const typeToDeliveryType = { email: 'emailDeviceToken' };
    return client.registerInstallation({
      installationId,
      deliveryMechanism: {
        deliveryMechanismType: {
          case: typeToDeliveryType[deviceType] as any,
          value: deviceToken,
        },
      },
    });
  }

  /**
   * Unregister an installation
   * @param installationId The installation ID
   * @returns
   */
  async unregisterInstallation(installationId: string) {
    const client = this.getClient();
    return client.deleteInstallation({
      installationId,
    });
  }

  /**
   * Subscribe to a topic
   * @param installationId The installation ID
   * @param topics The topics to subscribe to
   * @returns
   */
  async subscribe(installationId: string, topics: string[]) {
    const client = this.getClient();
    return client.subscribe({
      installationId,
      topics: topics,
    });
  }

  /**
   * Unsubscribe from a topic
   * @param installationId The installation ID
   * @param topics The topics to unsubscribe from
   */
  async unsubscribe(installationId: string, topics: string[]) {
    const client = this.getClient();
    return client.unsubscribe({
      installationId,
      topics: topics,
    });
  }
}
