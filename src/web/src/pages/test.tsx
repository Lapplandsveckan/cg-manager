import { DefaultContentLayout } from '../components/DefaultContentLayout';
import { useSocket } from '../lib/';
import { PlaylistLayout } from '../components/playlist/PlaylistLayout';


const Page = () => {
    const conn = useSocket();

    return (
        <DefaultContentLayout>
            <PlaylistLayout/>
        </DefaultContentLayout>
    );
};

export default Page;