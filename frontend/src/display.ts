/** Presentation only: persisted identifiers remain unchanged in all commands. */
export const printerLabel=(id:string)=>id.replace(/^printer-(\d+)$/,'Printer $1');
export const partLabel=(id:string)=>'Part '+id.split('-').at(-1);
export const orderLabel=(id:string)=>'Order '+id.replaceAll('-','').slice(-6).toUpperCase();

/** Sum of estimated printer work, independent of parallel scheduling and queue waits. */
export function printDuration(seconds:number){
 const minutes=Math.ceil(seconds/60),hours=Math.floor(minutes/60),remainder=minutes%60;
 return hours?`${hours} h${remainder?` ${remainder} min`:''}`:`${minutes} min`;
}
