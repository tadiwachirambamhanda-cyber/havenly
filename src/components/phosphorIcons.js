// Runtime map of the Phosphor icons the app uses, one file per icon so
// Metro only bundles these (it doesn't tree-shake the package root).
// Kept as plain JS with a .d.ts beside it: TypeScript reads the .d.ts and
// never parses Phosphor's .tsx sources, whose internal base component
// doesn't type-check against this app's react-native-svg version.

import { AirplaneIcon } from 'phosphor-react-native/src/icons/Airplane';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { BarbellIcon } from 'phosphor-react-native/src/icons/Barbell';
import { BellIcon } from 'phosphor-react-native/src/icons/Bell';
import { BookIcon } from 'phosphor-react-native/src/icons/Book';
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen';
import { BookmarkSimpleIcon } from 'phosphor-react-native/src/icons/BookmarkSimple';
import { BroomIcon } from 'phosphor-react-native/src/icons/Broom';
import { BusIcon } from 'phosphor-react-native/src/icons/Bus';
import { CalendarBlankIcon } from 'phosphor-react-native/src/icons/CalendarBlank';
import { CameraIcon } from 'phosphor-react-native/src/icons/Camera';
import { CarIcon } from 'phosphor-react-native/src/icons/Car';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { ChatCircleIcon } from 'phosphor-react-native/src/icons/ChatCircle';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CheckCircleIcon } from 'phosphor-react-native/src/icons/CheckCircle';
import { CircleIcon } from 'phosphor-react-native/src/icons/Circle';
import { CircleNotchIcon } from 'phosphor-react-native/src/icons/CircleNotch';
import { ClipboardTextIcon } from 'phosphor-react-native/src/icons/ClipboardText';
import { CoffeeIcon } from 'phosphor-react-native/src/icons/Coffee';
import { ConfettiIcon } from 'phosphor-react-native/src/icons/Confetti';
import { CookingPotIcon } from 'phosphor-react-native/src/icons/CookingPot';
import { CopyIcon } from 'phosphor-react-native/src/icons/Copy';
import { CouchIcon } from 'phosphor-react-native/src/icons/Couch';
import { DeviceMobileIcon } from 'phosphor-react-native/src/icons/DeviceMobile';
import { DotsThreeIcon } from 'phosphor-react-native/src/icons/DotsThree';
import { EnvelopeSimpleIcon } from 'phosphor-react-native/src/icons/EnvelopeSimple';
import { FileTextIcon } from 'phosphor-react-native/src/icons/FileText';
import { FunnelSimpleIcon } from 'phosphor-react-native/src/icons/FunnelSimple';
import { GameControllerIcon } from 'phosphor-react-native/src/icons/GameController';
import { GearIcon } from 'phosphor-react-native/src/icons/Gear';
import { GiftIcon } from 'phosphor-react-native/src/icons/Gift';
import { GraduationCapIcon } from 'phosphor-react-native/src/icons/GraduationCap';
import { FlameIcon } from 'phosphor-react-native/src/icons/Flame';
import { HairDryerIcon } from 'phosphor-react-native/src/icons/HairDryer';
import { HandWavingIcon } from 'phosphor-react-native/src/icons/HandWaving';
import { HeartIcon } from 'phosphor-react-native/src/icons/Heart';
import { HouseIcon } from 'phosphor-react-native/src/icons/House';
import { ImageIcon } from 'phosphor-react-native/src/icons/Image';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { KeyIcon } from 'phosphor-react-native/src/icons/Key';
import { LightningIcon } from 'phosphor-react-native/src/icons/Lightning';
import { LockIcon } from 'phosphor-react-native/src/icons/Lock';
import { MagnifyingGlassIcon } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { MapPinIcon } from 'phosphor-react-native/src/icons/MapPin';
import { MartiniIcon } from 'phosphor-react-native/src/icons/Martini';
import { MoonIcon } from 'phosphor-react-native/src/icons/Moon';
import { PaletteIcon } from 'phosphor-react-native/src/icons/Palette';
import { PaperPlaneRightIcon } from 'phosphor-react-native/src/icons/PaperPlaneRight';
import { PhoneIcon } from 'phosphor-react-native/src/icons/Phone';
import { PlayIcon } from 'phosphor-react-native/src/icons/Play';
import { PlusIcon } from 'phosphor-react-native/src/icons/Plus';
import { ShareNetworkIcon } from 'phosphor-react-native/src/icons/ShareNetwork';
import { ShieldCheckIcon } from 'phosphor-react-native/src/icons/ShieldCheck';
import { ShoppingBagIcon } from 'phosphor-react-native/src/icons/ShoppingBag';
import { SneakerMoveIcon } from 'phosphor-react-native/src/icons/SneakerMove';
import { SoccerBallIcon } from 'phosphor-react-native/src/icons/SoccerBall';
import { SpeakerHighIcon } from 'phosphor-react-native/src/icons/SpeakerHigh';
import { SpeakerSlashIcon } from 'phosphor-react-native/src/icons/SpeakerSlash';
import { SquaresFourIcon } from 'phosphor-react-native/src/icons/SquaresFour';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { SwimmingPoolIcon } from 'phosphor-react-native/src/icons/SwimmingPool';
import { TagIcon } from 'phosphor-react-native/src/icons/Tag';
import { TennisBallIcon } from 'phosphor-react-native/src/icons/TennisBall';
import { ThumbsUpIcon } from 'phosphor-react-native/src/icons/ThumbsUp';
import { TrashIcon } from 'phosphor-react-native/src/icons/Trash';
import { TrayIcon } from 'phosphor-react-native/src/icons/Tray';
import { UserIcon } from 'phosphor-react-native/src/icons/User';
import { UserPlusIcon } from 'phosphor-react-native/src/icons/UserPlus';
import { UsersIcon } from 'phosphor-react-native/src/icons/Users';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { WarningCircleIcon } from 'phosphor-react-native/src/icons/WarningCircle';
import { WashingMachineIcon } from 'phosphor-react-native/src/icons/WashingMachine';
import { WavesIcon } from 'phosphor-react-native/src/icons/Waves';
import { WifiHighIcon } from 'phosphor-react-native/src/icons/WifiHigh';
import { XIcon } from 'phosphor-react-native/src/icons/X';

export const ICONS = {
  'airplane': AirplaneIcon,
  'alert-circle': WarningCircleIcon,
  'alert-triangle': WarningIcon,
  'arrow-left': ArrowLeftIcon,
  'barbell': BarbellIcon,
  'bell': BellIcon,
  'book': BookIcon,
  'book-open': BookOpenIcon,
  'bookmark': BookmarkSimpleIcon,
  'broom': BroomIcon,
  'bus': BusIcon,
  'calendar': CalendarBlankIcon,
  'camera': CameraIcon,
  'car': CarIcon,
  'check': CheckIcon,
  'check-circle': CheckCircleIcon,
  'chevron-right': CaretRightIcon,
  'circle': CircleIcon,
  'clipboard': ClipboardTextIcon,
  'coffee': CoffeeIcon,
  'confetti': ConfettiIcon,
  'cooking-pot': CookingPotIcon,
  'copy': CopyIcon,
  'couch': CouchIcon,
  'file-text': FileTextIcon,
  'filter': FunnelSimpleIcon,
  'game-controller': GameControllerIcon,
  'gift': GiftIcon,
  'graduation-cap': GraduationCapIcon,
  'grid': SquaresFourIcon,
  'flame': FlameIcon,
  'hair-dryer': HairDryerIcon,
  'hand-waving': HandWavingIcon,
  'heart': HeartIcon,
  'home': HouseIcon,
  'image': ImageIcon,
  'inbox': TrayIcon,
  'info': InfoIcon,
  'key': KeyIcon,
  'loader': CircleNotchIcon,
  'lock': LockIcon,
  'mail': EnvelopeSimpleIcon,
  'map-pin': MapPinIcon,
  'martini': MartiniIcon,
  'message-circle': ChatCircleIcon,
  'moon': MoonIcon,
  'more-horizontal': DotsThreeIcon,
  'palette': PaletteIcon,
  'phone': PhoneIcon,
  'play': PlayIcon,
  'plus': PlusIcon,
  'search': MagnifyingGlassIcon,
  'send': PaperPlaneRightIcon,
  'settings': GearIcon,
  'share': ShareNetworkIcon,
  'shield-check': ShieldCheckIcon,
  'shopping-bag': ShoppingBagIcon,
  'smartphone': DeviceMobileIcon,
  'sneaker': SneakerMoveIcon,
  'soccer-ball': SoccerBallIcon,
  'sun': SunIcon,
  'swimming-pool': SwimmingPoolIcon,
  'tag': TagIcon,
  'tennis-ball': TennisBallIcon,
  'thumbs-up': ThumbsUpIcon,
  'trash': TrashIcon,
  'user': UserIcon,
  'user-plus': UserPlusIcon,
  'users': UsersIcon,
  'volume-off': SpeakerSlashIcon,
  'volume-on': SpeakerHighIcon,
  'washing-machine': WashingMachineIcon,
  'waves': WavesIcon,
  'wifi': WifiHighIcon,
  'x': XIcon,
  'zap': LightningIcon,
};
