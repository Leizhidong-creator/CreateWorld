/**
 * @typedef {{x:number,y:number}} Point
 * @typedef {{x:number,y:number,w:number,h:number}} Rect
 * @typedef {{id:string,type:'image'|'audio',src:string}} Asset
 * @typedef {{all?:Condition[],any?:Condition[],not?:Condition,flag?:string,equals?:unknown,item?:string,count?:number,clue?:string,quest?:string,status?:'locked'|'active'|'done',visited?:string,discovered?:string,counter?:string,atLeast?:number,scene?:string}} Condition
 * @typedef {{type:string,id?:string,value?:unknown,count?:number,position?:Point,text?:string}} Action
 * @typedef {{id:string,rect:Rect,label:string,name?:string,range?:number,when?:Condition,hold?:number,once?:boolean,actions?:Action[],branches?:{when?:Condition,actions:Action[]}[]}} Interaction
 * @typedef {{id:string,name:string,width:number,height:number,collisions:Rect[],objects:object[],npcs:object[],interactions:Interaction[],exits:object[],regions:object[],triggers?:object[]}} SceneConfig
 * @typedef {{id:string,title:string,subtitle:string,description:string,start:{scene:string,position:Point},player:{character:string,speed:number,radius:number},theme:object,assets:Asset[],assetBase?:string|URL,scenes:SceneConfig[],characters:object[],dialogues:object[],quests:object[],items:object[],clues:object[],achievements:object[],endings:object[],minigames:object[],features?:object,saveVersion?:number,hooks?:object}} GameConfig
 */
export {};
