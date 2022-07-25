import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class WebSocketService {
  @WebSocketServer()
  server: Server;

  /**
   * Emit an event
   * @param ev The event name
   * @param args The event arguments
   */
  emit(ev: string, ...args: any[]) {
    this.server.emit(ev, ...args);
  }
}
