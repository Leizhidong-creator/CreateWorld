export interface World {
  id: 'harbor' | 'walls' | 'mountain' | 'station' | 'dust';
  title: string;
  english: string;
  cover: string;
  tagline: string;
  description: string;
  creatorNote?: string;
  tags: string[];
  features: string[];
  playable: boolean;
  showcase?: boolean;
  local?: boolean;
  story: string;
  design: string;
  adaptationSource?: string;
  processArt?: {
    before: string;
    after: string;
    beforeAlt: string;
    afterAlt: string;
    request: string;
  };
}

export const worlds: World[] = [
  {
    id: 'walls', title: '高墙之外', english: 'BEYOND THE HIGH WALLS',
    cover: '/worlds/walls.webp', tagline: '高墙困住脚步，却困不住希望。',
    description: '改编自电影《肖申克的救赎》。在高墙与漫长岁月之间，走进一段关于希望、友谊与自由的像素冒险。',
    creatorNote: '《高墙之外》是我最早的一次游戏改编尝试。制作之初，Create World 的想法还没有成形；随着开发推进，这个平台的雏形才逐渐清晰。后来，我陆续搭建了许多 Skills 和工具工作流，用它们自动迭代这款游戏，打磨出如今的版本。这些 Skills 与工作流，正是 Create World 的前身。',
    tags: ['剧情冒险', '探索', '解谜'], features: ['走近高墙之内的日常与人物', '寻找线索，把希望变成行动', '见证从漫长等待到重获自由的旅程'],
    playable: true, showcase: true,
    story: '高墙隔开了外面的世界，却没有带走一个人的希望。在日复一日的等待中，他和朋友一起寻找改变命运的可能。',
    design: '将封闭空间转化为可探索的房间与院子，以人物对话、线索和行动推进剧情。用暗色石墙与暖金光线表现压抑中的希望。',
    adaptationSource: '电影《肖申克的救赎》',
    processArt: {
      before: '/worlds/walls-courtyard-day.webp',
      after: '/worlds/walls-courtyard-night.webp',
      beforeAlt: '高墙之外游戏概念图：夕光下的监狱院落，两位囚友坐在石凳上交谈，右侧是亮灯的图书馆。',
      afterAlt: '高墙之外游戏概念图：相同院落与人物布局，改为冷蓝夜色，图书馆的暖光照亮门前石路。',
      request: '让院子进入深夜，留下图书馆的暖光。',
    },
  },
  {
    id: 'harbor', title: '雾港来信', english: 'LETTERS FROM THE QUIET HARBOR',
    cover: '/worlds/coast.webp', tagline: '一座灯塔，一封没有寄出的信。',
    description: '灯塔熄灭的第三个夜晚，一封未寄出的信，把你带回海边。穿过旧港，听完留下来的故事。',
    tags: ['探索', '人物对话', '轻解谜'], features: ['穿过旧港，寻找留下的讯息', '与守灯人交谈，走进档案室', '点亮信号灯，选择如何回应'],
    playable: true,
    story: '灯塔熄灭的第三个夜晚，一封未寄出的信，把你带回海边。有人仍在等一份迟来的回应。',
    design: '小屋、旧港和档案室组成探索路线。与守灯人交谈取得钥匙，找到信件，再点亮信号灯。',
  },
  {
    id: 'mountain', title: '山风归途', english: 'WHERE THE MOUNTAIN WIND GOES',
    cover: '/worlds/mountain.webp', tagline: '沿着旧地图，走回记忆深处。',
    description: '带着一张旧地图穿过山林，在沿途的村落里，拼起一段被遗忘的往事。',
    tags: ['旅行', '叙事', '山野'], features: ['循着旧地图走过山间小路', '听村民讲述不同的往事', '在故乡寻找自己的答案'],
    playable: false,
    story: '旅人收到一张残缺的旧地图，循着上面的标记回到故乡。每一处停留，都有人记得不同版本的过去。',
    design: '构想用山路连接村落与森林，让旧物触发人物回忆。此案例目前展示题材与美术方向。',
  },
  {
    id: 'station', title: '轨道余声', english: 'ECHOES OF THE ORBIT',
    cover: '/worlds/train.webp', tagline: '讯号沉寂之后，仍有人等待回音。',
    description: '走进寂静的轨道站，寻找遗失的记录。与留守者交谈，让一段沉默的讯号重新传来。',
    tags: ['科幻', '对话', '调查'], features: ['探索站内的不同区域', '寻找记录，与留守者交谈', '恢复讯号，做出最后的选择'],
    playable: true,
    story: '轨道站的讯号安静了下来。留下的人守着一段记录，也守着一个尚未得到回答的问题。',
    design: '复用探索原型的区域与交互规则，替换科幻故事、对白和线索，体验同一玩法的另一种叙事。',
  },
];

export const localWorlds: World[] = [{
  id: 'dust', title: '尘埃之外', english: 'BEYOND THE DUST', cover: '/worlds/dust.webp',
  tagline: '从尘土中的家园，寻找通往群星的路。',
  description: '本机制作的双场景剧情游戏。成为库珀，探索农场与墨菲的房间，从掉落的书和沙尘纹路中寻找线索。',
  tags: ['科幻', '剧情探索', '5–8 分钟'],
  features: ['走过农舍、机棚与枯萎的玉米田', '在房间里调查书架与沙尘线索', '找到坐标，做出离开前的选择'],
  playable: true, local: true,
  story: '玉米正在枯萎，尘埃却留下了方向。一位父亲在女儿的房间里发现线索，也面对着留下或出发的选择。',
  design: '以农场和卧室两个场景串起调查、解读、告别与出发。移动探索、人物对话和线索收集共同推进故事。',
}];
export const worldById = (id: string) => [...worlds, ...localWorlds].find(world => world.id === id);

// Homepage cards are independent of the featured harbor hero.
export const featuredWorlds = worlds.filter(world => world.id !== 'harbor');
