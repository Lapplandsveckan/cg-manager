import { useTranslation } from 'react-i18next';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CreateNewFolderRoundedIcon from '@mui/icons-material/CreateNewFolderRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useRegisterCommands } from '../../components/commandPalette/CommandPaletteProvider';
import type { CommandItem } from '../../components/commandPalette/types';
import { useToast } from '../../components/ToastProvider';
import type { MediaDoc } from '../api/caspar';
import { queryClient } from '../query/client';
import { qk } from '../query/keys';
import {
    refreshFolders,
    useMediaDocsQuery,
    useMediaMutations,
} from '../query/media';

interface MediaCommandsArgs {
    path: string;
    navigate: (path: string) => void;
    upload: () => unknown;
    inspect: (clip: MediaDoc) => void;
    play?: (clip: MediaDoc) => unknown;
}

export function useMediaCommands({
    path,
    navigate,
    upload,
    inspect,
    play,
}: MediaCommandsArgs) {
    const { t } = useTranslation('common');
    const notify = useToast();
    const { createFolder } = useMediaMutations();
    const { data: media } = useMediaDocsQuery();

    const createAndOpen = async (name: string) => {
        const created = await createFolder.mutateAsync(`${path}${name}`);
        notify(t('media.success.folderCreated'), 'success');
        navigate(created.path);
    };

    const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: qk.media });
        refreshFolders();
    };

    const clipCommands =
        (run: (clip: MediaDoc) => unknown) => (): CommandItem[] =>
            Object.values(media ?? {}).map(clip => ({
                id: `media.clip.${clip.id}`,
                label: clip.id,
                run: () => run(clip),
            }));

    useRegisterCommands(
        () => [
            {
                id: 'media.upload',
                label: t('commandPalette.commands.uploadMedia'),
                icon: <CloudUploadRoundedIcon fontSize="small" />,
                run: upload,
            },
            {
                id: 'media.newFolder',
                label: t('commandPalette.commands.newFolder'),
                icon: <CreateNewFolderRoundedIcon fontSize="small" />,
                prompt: {
                    placeholder: t('commandPalette.commands.folderPlaceholder'),
                    submitLabel: value =>
                        t('commandPalette.commands.createNamed', { value }),
                    submit: createAndOpen,
                },
            },
            {
                id: 'media.refresh',
                label: t('commandPalette.commands.refreshMedia'),
                icon: <RefreshRoundedIcon fontSize="small" />,
                run: refresh,
            },
            play && {
                id: 'media.play',
                label: t('commandPalette.commands.playClip'),
                icon: <PlayArrowRoundedIcon fontSize="small" />,
                children: clipCommands(play),
            },
            {
                id: 'media.inspect',
                label: t('commandPalette.commands.inspectClip'),
                icon: <InfoOutlinedIcon fontSize="small" />,
                children: clipCommands(inspect),
            },
        ],
        { section: t('commandPalette.sections.media'), priority: 100 },
    );
}
