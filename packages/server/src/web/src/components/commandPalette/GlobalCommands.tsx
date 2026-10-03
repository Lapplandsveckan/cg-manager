import { useAppCommands } from '../../lib/commands/useAppCommands';
import { useNavigationCommands } from '../../lib/commands/useNavigationCommands';

export const GlobalCommands: React.FC = () => {
    useNavigationCommands();
    useAppCommands();
    return null;
};
