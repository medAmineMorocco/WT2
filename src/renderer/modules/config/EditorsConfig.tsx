import React from 'react';
import IntellijIcon from '../../components/editors/IntellijIcon';
import WebstormIcon from '../../components/editors/WebstormIcon';
import RiderIcon from '../../components/editors/RiderIcon';
import PycharmIcon from '../../components/editors/PyCharmIcon';
import ClionIcon from '../../components/editors/ClionIcon';
import PhpstormIcon from '../../components/editors/PhpStormIcon';
import RubymineIcon from '../../components/editors/RubyMineIcon';
import GoLandIcon from '../../components/editors/GoLandIcon';
import VsCodeIcon from '../../components/editors/VsCodeIcon';
import EclipseIcon from '../../components/editors/EclipseIcon';
import BracketsIcon from '../../components/editors/BracketsIcon';
import AndroidStudioIcon from '../../components/editors/AndroidStudioIcon';
import XcodeIcon from '../../components/editors/XcodeIcon';
import SublimeIcon from '../../components/editors/SublimeIcon';
import VimIcon from '../../components/editors/VimIcon';

export const editorIconsMap = {
  IntellijIcon: <IntellijIcon width="30px" height="30px" />,
  WebstormIcon: <WebstormIcon width="30px" height="30px" />,
  RiderIcon: <RiderIcon width="30px" height="30px" />,
  PycharmIcon: <PycharmIcon width="30px" height="30px" />,
  ClionIcon: <ClionIcon width="30px" height="30px" />,
  PhpstormIcon: <PhpstormIcon width="30px" height="30px" />,
  RubymineIcon: <RubymineIcon width="30px" height="30px" />,
  GoLandIcon: <GoLandIcon width="30px" height="30px" />,
  VsCodeIcon: <VsCodeIcon width="30px" height="30px" />,
  EclipseIcon: <EclipseIcon width="30px" height="30px" />,
  BracketsIcon: <BracketsIcon width="30px" height="30px" />,
  AndroidStudioIcon: <AndroidStudioIcon width="30px" height="30px" />,
  XcodeIcon: <XcodeIcon width="30px" height="30px" />,
  SublimeIcon: <SublimeIcon width="30px" height="30px" />,
  VimIcon: <VimIcon width="30px" height="30px" />,
};

export const editorsCst = [
  {
    key: '0-2',
    label: 'Intellij',
    icon: 'IntellijIcon',
    path: '',
    defaultCommand: 'idea',
    settingsFolder: '.idea',
    description:
      'Import and manage Java projects effortlessly, utilizing advanced tools for code analysis, debugging, and version control',
    enabled: true,
  },
  {
    key: '0-3',
    label: 'Webstorm',
    icon: 'WebstormIcon',
    path: '',
    defaultCommand: 'webstorm',
    settingsFolder: '.idea',
    description:
      'Create and manage web development projects effortlessly, leveraging specialized tools and features tailored for front-end and back-end development in WebStorm.',
    enabled: true,
  },
  {
    key: '0-4',
    label: 'Rider',
    icon: 'RiderIcon',
    path: '',
    defaultCommand: 'rider',
    settingsFolder: '.idea',
    description:
      "Effortlessly manage and develop .NET projects, including ASP.NET, Xamarin, and Unity, using Rider's powerful IDE tailored for .NET development.",
    enabled: true,
  },
  {
    key: '0-5',
    label: 'PyCharm',
    icon: 'PycharmIcon',
    path: '',
    defaultCommand: 'pycharm',
    settingsFolder: '.idea',
    description:
      "Efficiently develop Python projects with PyCharm's intelligent code completion, debugging, and version control features tailored for Python development.",
    enabled: true,
  },
  {
    key: '0-6',
    label: 'CLion',
    icon: 'ClionIcon',
    path: '',
    defaultCommand: 'clion',
    settingsFolder: '.idea',
    description:
      "Seamlessly develop C and C++ projects with CLion's advanced coding assistance, refactorings, and integrated debugger tailored for C and C++ development.",
    enabled: true,
  },
  {
    key: '0-7',
    label: 'PhpStorm',
    icon: 'PhpstormIcon',
    path: '',
    defaultCommand: 'phpstorm',
    settingsFolder: '.idea',
    description:
      "Effortlessly develop PHP projects with PhpStorm's intelligent code completion, refactorings, and comprehensive framework support tailored for PHP development.",
    enabled: true,
  },
  {
    key: '0-8',
    label: 'RubyMine',
    icon: 'RubymineIcon',
    path: '',
    defaultCommand: 'rubymine',
    settingsFolder: '.idea',
    description:
      "Effortlessly develop Ruby and Rails projects with RubyMine's intelligent code completion, refactorings, and comprehensive framework support tailored for Ruby development.",
    enabled: true,
  },
  {
    key: '0-9',
    label: 'GoLand',
    icon: 'GoLandIcon',
    path: '',
    defaultCommand: 'goland',
    settingsFolder: '.idea',
    description:
      "Effortlessly develop Go projects with GoLand's intelligent code completion, refactorings, and comprehensive support tailored specifically for Go development.",
    enabled: true,
  },
  {
    key: '0-10',
    label: 'Visual Studio',
    icon: 'VsCodeIcon',
    path: '',
    defaultCommand: 'code',
    settingsFolder: '.vscode',
    description:
      'Edit various programming projects with ease, from web development to cloud-based applications.',
    enabled: true,
  },
  {
    key: '0-11',
    label: 'Eclipse',
    icon: 'EclipseIcon',
    path: '',
    defaultCommand: 'eclipse',
    settingsFolder: '.settings',
    description:
      'Create and manage Java projects with ease, leveraging a wide range of plugins and tools for software development.',
    enabled: true,
  },
  {
    key: '0-12',
    label: 'Brackets',
    icon: 'BracketsIcon',
    path: '',
    defaultCommand: 'brackets',
    settingsFile: '.brackets.json',
    description:
      'Build and design responsive websites and web applications using intuitive features tailored for web development.',
    enabled: true,
  },
  {
    key: '0-13',
    label: 'Android Studio',
    icon: 'AndroidStudioIcon',
    path: '',
    defaultCommand: 'open',
    settingsFolder: '.idea',
    description:
      'Develop Android applications seamlessly, taking advantage of specialized tools and integrations for Android app development.',
    enabled: true,
  },
  {
    key: '0-14',
    label: 'Sublime Text',
    icon: 'SublimeIcon',
    path: '',
    defaultCommand: 'subl',
    settingsFolder: '.sublime-project',
    description:
      'Seamlessly work on coding projects ranging from simple scripts to complex software applications.',
    enabled: true,
  },
  {
    key: '0-15',
    label: 'Vim',
    icon: 'VimIcon',
    path: '',
    defaultCommand: 'vim',
    description:
      'Handle coding tasks efficiently, from quick edits to large-scale software development, using its powerful modal editing features.',
    enabled: true,
  },
];
