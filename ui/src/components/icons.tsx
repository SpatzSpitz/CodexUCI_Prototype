import MicIcon from '@mui/icons-material/Mic';
import HeadsetIcon from '@mui/icons-material/Headset';
import BluetoothIcon from '@mui/icons-material/Bluetooth';
import SettingsInputHdmiIcon from '@mui/icons-material/SettingsInputHdmi';
import VideocamIcon from '@mui/icons-material/Videocam';
import ComputerIcon from '@mui/icons-material/Computer';
import MusicNoteIcon from '@mui/icons-material/MusicNote';
import SpeakerIcon from '@mui/icons-material/Speaker';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import EqualizerIcon from '@mui/icons-material/Equalizer';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeDownIcon from '@mui/icons-material/VolumeDown';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import RouterIcon from '@mui/icons-material/Router';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import TabletIcon from '@mui/icons-material/Tablet';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import LanIcon from '@mui/icons-material/Lan';
import WifiIcon from '@mui/icons-material/Wifi';
import UsbIcon from '@mui/icons-material/Usb';
import RadioIcon from '@mui/icons-material/Radio';
import AlbumIcon from '@mui/icons-material/Album';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import AudiotrackIcon from '@mui/icons-material/Audiotrack';
import TvIcon from '@mui/icons-material/Tv';
import MovieIcon from '@mui/icons-material/Movie';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import CameraIcon from '@mui/icons-material/Camera';

export const iconMap = {
  mic: MicIcon,
  headset: HeadsetIcon,
  bluetooth: BluetoothIcon,
  hdmi: SettingsInputHdmiIcon,
  video: VideocamIcon,
  pc: ComputerIcon,
  music: MusicNoteIcon,
  speaker: SpeakerIcon,
  graphiceq: GraphicEqIcon,
  equalizer: EqualizerIcon,
  volumeup: VolumeUpIcon,
  volumedown: VolumeDownIcon,
  volumeoff: VolumeOffIcon,
  power: PowerSettingsNewIcon,
  router: RouterIcon,
  smartphone: SmartphoneIcon,
  tablet: TabletIcon,
  desktop: DesktopWindowsIcon,
  lan: LanIcon,
  wifi: WifiIcon,
  usb: UsbIcon,
  radio: RadioIcon,
  album: AlbumIcon,
  queuemusic: QueueMusicIcon,
  audiotrack: AudiotrackIcon,
  tv: TvIcon,
  movie: MovieIcon,
  cameraalt: CameraAltIcon,
  camera: CameraIcon,
} as const;

export type IconKey = keyof typeof iconMap;

export function IconByKey({ name, size = 32 }: { name?: string; size?: number }) {
  const key = (name || 'mic').toLowerCase().replace(/[^a-z0-9]/g, '') as IconKey;
  const Comp = (iconMap as any)[key] || MicIcon;
  return <Comp sx={{ fontSize: size }} />;
}

export const allIconOptions: { key: string; label: string }[] = Object.keys(iconMap).map(k => ({ key: k, label: k }));
