import { DefaultContentLayout } from '../components/DefaultContentLayout';
import { useSocket } from '../lib/hooks/useSocket';
import { PlaylistLayout } from '../components/Playlist/PlaylistLayout';


const Page = () => {

    const conn = useSocket();

    return (
        <DefaultContentLayout>
            <PlaylistLayout/>
        </DefaultContentLayout>
    );

};

export default Page;