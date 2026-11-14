/** Presentation only: persisted identifiers remain unchanged in all commands. */
export const printerLabel=(id:string)=>id.replace(/^printer-(\d+)$/,'Printer $1');
export const partLabel=(id:string)=>'Part '+id.split('-').at(-1);
export const orderLabel=(id:string)=>'Order '+id.replaceAll('-','').slice(-6).toUpperCase();
