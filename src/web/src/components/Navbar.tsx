import {IconButton, Stack, SvgIconTypeMap, Typography} from '@mui/material';
import {useVersion} from '../lib/hooks/useVersion';
import HomeIcon from '@mui/icons-material/Home';
import ComputerIcon from '@mui/icons-material/Computer';
import ImageIcon from '@mui/icons-material/Image';
import {OverridableComponent} from '@mui/material/OverridableComponent';
import {useRouter} from 'next/router';

const NavbarButton: React.FC<{ href: string, icon: OverridableComponent<SvgIconTypeMap<{}, "svg">> }> = ({ href, icon }) => {
    const router = useRouter();
    const Icon = icon;

    return (
        <IconButton
            size="large"
            onClick={() => router.push(href)}
        >
            <Icon htmlColor="#FFF" />
        </IconButton>
    );
}

export const Navbar = () => {
    const version = useVersion();

    return (
        <Stack direction="column" alignItems="stretch" justifyContent="space-between" width="60px" bgcolor="#272727" p={1} >
            <Stack alignItems="center" justifyContent="start" >
                <NavbarButton href="/" icon={HomeIcon} />
                <NavbarButton href="/server" icon={ComputerIcon} />
                <NavbarButton href="/media" icon={ImageIcon} />
            </Stack>

            <Typography textAlign="center" fontSize={12} >{`v${version}`}</Typography>
        </Stack>
    );
};