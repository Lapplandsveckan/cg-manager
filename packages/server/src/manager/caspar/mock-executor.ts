import { CasparExecutor } from './executor';
import { type AmcpTransport } from './amcp-socket';
import { MockAmcpSocket } from './mock-socket';

export class MockCasparExecutor extends CasparExecutor {
    protected createSocket(): AmcpTransport {
        return new MockAmcpSocket();
    }
}
