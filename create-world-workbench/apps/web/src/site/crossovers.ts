import type { MarketplaceGame } from './marketplace.js';

export interface CrossoverConcept {
  pairing: [string, string];
  kicker: string;
  hook: string;
  worlds: [string, string];
  story: string;
  roles: [string, string];
  play: { title: string; description: string }[];
  twists: string[];
  genre: string;
}

const concepts: { id: string; title: string; subtitle: string; tags: string[]; concept: CrossoverConcept }[] = [
  {
    id: 'marvel-threebody', title: '漫威 × 三体：最后的变量',
    subtitle: '指挥英雄小队抵御三体入侵，在城市救援与文明存续之间抉择。', tags: ['科幻', '联动', '合作'],
    concept: {
      pairing: ['漫威英雄', '三体文明'], kicker: 'SUPERPOWERS / DARK FOREST',
      hook: '这一次，反派甚至不打算和你说话。',
      worlds: ['装甲、魔法与雷霆：个人可以改变战局。', '智子、水滴与黑暗森林：文明首先考虑生存。'],
      story: '一枚水滴穿过近地防线，所有熟悉的胜利公式同时失效。钢铁侠想拆解它，奇异博士寻找没有被封死的未来，美国队长坚持先救下眼前的人。你将协调英雄小队，在正面作战、科技试探与暴露宇宙坐标之间做出选择。真正的敌人，可能是“必须赢下这一战”的执念。',
      roles: ['英雄小队｜组合能力，争取局部战场的机会。', '三体文明｜封锁信息，以文明尺度推演下一步。'],
      play: [
        { title: '先救人，还是先守阵地', description: '回合内分配英雄与撤离路线；战术胜利和城市存续采用不同目标。' },
        { title: '用一次失败换一条情报', description: '试探水滴的行动规律，把战斗所得变成下一轮部署的依据。' },
        { title: '留下最后一个变量', description: '决定是否释放宇宙信号，让不同阵营重新计算胜利的代价。' },
      ],
      twists: ['自由搭配英雄阵容，以不同能力组合完成救援、侦察与防御任务。', '通过三体观察者档案还原敌方推演，解锁战役中的隐藏情报。'], genre: '小队战术 · 文明博弈',
    },
  },
  {
    id: 'wukong-daiyu', title: '孙悟空 × 林黛玉：不认天命',
    subtitle: '切换悟空与黛玉，闯过太虚幻境，用金箍棒与诗句改写判词。', tags: ['叙事', '剧情冒险', '联动', '改编'],
    concept: {
      pairing: ['孙悟空', '林黛玉'], kicker: 'REBEL / POET',
      hook: '金箍棒能打碎的，偏偏不是她的心事。',
      worlds: ['西游的神魔与反抗：不服，就打出一条路。', '红楼的诗意与人情：命运藏在每一句话里。'],
      story: '一片落花误入花果山，一页判词落在金箍棒前。悟空闯进大观园，要替黛玉改掉早已写定的结局；黛玉却发现，这位号称不受拘束的大圣，头上也有一道看不见的规矩。两人循着残页穿行幻境，重新理解什么叫“不认命”。',
      roles: ['孙悟空｜打破幻境、开辟道路，却不擅长读懂弦外之音。', '林黛玉｜从诗句和对话中辨出真意，找到蛮力触不到的机关。'],
      play: [
        { title: '一根金箍棒，一句未尽诗', description: '切换两位角色：悟空处理空间阻碍，黛玉以诗句还原事件。' },
        { title: '别替我选结局', description: '对话选择会改变彼此的信任；帮助对方，也要尊重对方的决定。' },
        { title: '把判词留白', description: '收集散落的命运残页，在结尾决定改写、撕毁，还是把笔交还本人。' },
      ],
      twists: ['跟随黛玉进入天宫，在诗辩支线中解开众仙隐瞒的判词线索。', '在能力互换的幻境关卡中，以全新视角破解双方的命运机关。'], genre: '双主角叙事 · 幻境解谜',
    },
  },
  {
    id: 'thor-godzilla', title: '雷神 × 哥斯拉：雷霆登陆',
    subtitle: '挥动雷神之锤迎战哥斯拉，掌控引雷时机，追查海底能量源。', tags: ['科幻', '剧情冒险', '联动'],
    concept: {
      pairing: ['雷神索尔', '哥斯拉'], kicker: 'THUNDER / ATOMIC BREATH',
      hook: '锤子已经举起来了，整座港口都在屏息。',
      worlds: ['阿斯加德的神话力量：雷霆回应一人的意志。', '巨兽的生态秩序：一声怒吼就能改写城市地形。'],
      story: '海底出现陌生能量源，哥斯拉沿着异常信号登陆港湾。雷神把这场登陆视为入侵，却在第一轮交锋后发现：雷击正在为对手的背鳍充能。要赢下这一战，你得先弄清楚，是谁把双方引到了同一片海岸。',
      roles: ['雷神索尔｜机动突进、召回战锤，用雷电改变局部战场。', '哥斯拉｜以巨兽尺度压迫地形，积蓄能量后释放吐息。'],
      play: [
        { title: '接近那道蓝光', description: '观察背鳍蓄能与吐息方向，抓住攻击间隙近身。' },
        { title: '不是每道雷都该落下', description: '雷击既能造成冲击，也可能强化对手；用引雷点控制风险。' },
        { title: '先打一架，再决定站哪边', description: '在击退巨兽与合作摧毁海底装置之间，打开不同收束方向。' },
      ],
      twists: ['解锁哥斯拉视角的挑战关卡，利用巨兽体型与吐息控制战场。', '穿越至阿斯加德战场，在神域地形中迎接新的巨兽挑战。'], genre: '巨兽对决 · 动作策略',
    },
  },
  {
    id: 'qin-rome', title: '大秦 × 罗马：帝国交锋',
    subtitle: '统率秦军与罗马军团，争夺高地与粮道，决定两大帝国的边界。', tags: ['剧情冒险', '联动', '改编'],
    concept: {
      pairing: ['大秦军团', '罗马军团'], kicker: 'QIN / ROME',
      hook: '两套征服世界的答案，出现在同一张地图上。',
      worlds: ['东方秦军：弩阵、长兵与严整的军令。', '西方罗马军团：盾阵、道路与持续推进的战线。'],
      story: '一场架空的时空交错，把秦军边塞与罗马行省接到一起。双方都把陌生旗帜视作必须解决的威胁。你将从两位指挥官的视角看同一场遭遇战：前线争夺高地，后方争夺粮道，而翻译尚未完成的和平提议，正被压在军情文书下面。',
      roles: ['秦军指挥官｜发挥远程弩阵与长兵协同，控制接敌距离。', '罗马指挥官｜组织盾墙推进，依靠工事和补给维持战线。'],
      play: [
        { title: '同一地形，两种解法', description: '以双阵营关卡重走同一片战场，比较射程、阵形与地形的关系。' },
        { title: '让粮草先到前线', description: '部署不只消耗兵力，也牵动道路、运力和驻守资源。' },
        { title: '征服，还是先听懂对方', description: '在军事目标之外收集译文，决定战后边界如何划定。' },
      ],
      twists: ['挑战山地与平原两套战场，利用盾墙、弩阵与地形完成破局。', '体验使者与后勤官的支线任务，通过谈判与补给改变前线局势。'], genre: '架空历史 · 双阵营战术',
    },
  },
  {
    id: 'chatgpt-jenny', title: 'ChatGPT VS 珍妮纺织机',
    subtitle: '经营跨时代工坊，调配纺织机与 AI，平衡订单、效率与工人诉求。', tags: ['叙事', '解谜', '联动'],
    concept: {
      pairing: ['ChatGPT', '珍妮纺织机'], kicker: 'GENERATIVE AI / SPINNING JENNY',
      hook: '相隔两个多世纪，它们收到了同一份投诉。',
      worlds: ['工业时代的多锭纺纱：让双手的产出成倍增加。', '生成式 AI 的语言协作：让知识工作的流程重新分配。'],
      story: '一家不属于任何时代的工坊，接下了一份不可能的订单：既要生产布匹，也要写好销售它们的故事。珍妮纺织机坚持“先把线纺出来”，ChatGPT 提议“先重写整个流程”。你是这家工坊的协调人，要在效率、技能传承与工人诉求之间，找出一条能持续运转的路。',
      roles: ['ChatGPT｜协助拆解需求、生成方案；需要人来判断哪些输出可用。', '珍妮纺织机｜扩大纺纱能力；需要材料、维护与熟练操作。'],
      play: [
        { title: '把订单拆成工序', description: '给人、机器和 AI 分配任务，连接原料、生产、检验与表达。' },
        { title: '效率之外还有谁', description: '每次升级都会改变工时与岗位，听取不同工人的反馈再做决定。' },
        { title: '这回合，试试合作', description: '从互相比拼切换到协作，看产量、质量与满意度能否同时改善。' },
      ],
      twists: ['解锁印刷工序，把 AI 文案与实体生产串成完整的订单流水线。', '跟随学徒完成岗位成长任务，见证工坊升级带来的技能变化。'], genre: '工坊经营 · 议题叙事',
    },
  },
];

export const crossoverGames: MarketplaceGame[] = concepts.map(({ id, title, subtitle, tags, concept }) => ({
  id, title, subtitle, description: concept.story, tags, concept,
  cover: `/worlds/crossovers/${['wukong-daiyu', 'chatgpt-jenny', 'qin-rome'].includes(id) ? `${id}-v2` : id}.webp`, screenshots: [],
  author: { id: 'cw-concept', name: 'Create World · 共创工作室', avatar: '共' },
  pricing: { type: 'free', currency: 'CNY' },
  stats: { likes: 0, favorites: 0, comments: 0, plays: 0 },
  playable: false, remixable: true, createdAt: '2026-11-01', updatedAt: '2026-11-01',
}));
