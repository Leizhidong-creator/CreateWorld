window.STORYBOARD = {
  captionMs:4000,
  shots:[
    {title:'雪地对话 · 理论的开端',short:'雪地对话',frames:['a','b','c'],sequence:[0,1,2],frameMs:700,captions:['宇宙社会学，也许能解释文明之间真正的关系。','生存，是文明的第一需要。']},
    {title:'宇宙两条公理',short:'宇宙公理',frames:['a','b','c'],sequence:[0,1,2],frameMs:900,captions:['文明不断增长和扩张。','但宇宙中的物质总量，基本保持不变。']},
    {title:'两个文明互相发现',short:'互相发现',frames:['a','b'],sequence:[0,1],frameMs:1100,captions:['如果两个文明彼此发现，会发生什么？','他们无法知道，对方究竟是朋友，还是猎人。']},
    {title:'猜疑链形成',short:'猜疑链',frames:['a','b','c'],sequence:[0,1,2,1],frameMs:850,captions:['我不知道你是否善意。','你也不知道我是否会先发制人。','猜疑链，由此形成。']},
    {title:'黑暗森林的真相',short:'黑暗森林',frames:['a','b'],sequence:[0,1],frameMs:1500,captions:['宇宙，就是一座黑暗森林。','每个文明，都是带枪的猎人。','谁暴露自己，谁就可能先被消灭。']},
    {title:'罗辑意识到“咒语”的可能性',short:'咒语',frames:['a','b'],sequence:[0,1],frameMs:1200,captions:['如果暴露一个文明的位置……','宇宙中的猎人，就会替你开枪。','这，也许就是‘咒语’。']}
  ]
};
STORYBOARD.shots.forEach((s,i)=>s.frames=s.frames.map(f=>`assets/shot-${String(i+1).padStart(2,'0')}-${f}.png`));
