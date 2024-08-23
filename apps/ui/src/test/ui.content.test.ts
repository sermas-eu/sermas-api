import {
  EmailUIContentDto,
  HtmlUIContentDto,
  ImageUIContentDto,
  LinkUIContentDto,
  ObjectUIContentDto,
  UIContentDto,
  VideoUIContentDto,
  WebpageUIContentDto,
} from '../ui.content.dto';

const contents: UIContentDto[] = [
  {
    appId: 'mimex',
    contentType: 'video',
    content: {
      description:
        "Big Buck Bunny tells the story of a giant rabbit with a heart bigger than himself. When one sunny day three rodents rudely harass him, something snaps... and the rabbit ain't no bunny anymore! In the typical cartoon tradition he prepares the nasty rodents a comical revenge.\n\nLicensed under the Creative Commons Attribution license\nhttp://www.bigbuckbunny.org",
      sources: [
        'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      ],
      subtitle: 'By Blender Foundation',
      thumb: 'images/BigBuckBunny.jpg',
      title: 'Big Buck Bunny',
      width: 320,
      height: 280,
    },
  } as VideoUIContentDto,

  {
    appId: 'mimex',
    contentType: 'image',
    content: {
      src: 'https://sermasproject.eu/wp-content/uploads/2023/08/sermas-xr-homepage.png',
      height: 250,
      alt: 'SERMAS robot',
    },
  } as ImageUIContentDto,

  {
    appId: 'mimex',
    contentType: 'pdf',
    content: {
      url: 'https://example.com/fake.pdf',
    },
  } as WebpageUIContentDto,

  {
    appId: 'mimex',
    contentType: 'webpage',
    content: {
      url: 'https://example.com',
    },
  } as WebpageUIContentDto,

  {
    appId: 'mimex',
    contentType: 'object',
    content: {
      type: 'glb',
      url: 'https://github.com/KhronosGroup/glTF-Sample-Models/raw/master/2.0/Duck/glTF-Binary/Duck.glb',
    },
  } as ObjectUIContentDto,

  {
    appId: 'mimex',
    contentType: 'email',
    content: {
      email: 'info@sermasproject.eu',
      label: 'Contact sales',
    },
  } as EmailUIContentDto,

  {
    appId: 'mimex',
    contentType: 'html',
    content: {
      html: `<div class="title">Hello world</div>`,
    },
  } as HtmlUIContentDto,

  {
    appId: 'mimex',
    contentType: 'link',
    content: {
      url: 'http://sermas-project.eu/',
    },
  } as LinkUIContentDto,
];

export const getUiContent = (appId: string) => {};
