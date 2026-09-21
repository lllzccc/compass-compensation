import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
const out=new URL('../../outputs/demo/',import.meta.url);
const source=JSON.parse(await fs.readFile(new URL('source.json',out),'utf8'));
const schema=JSON.parse(await fs.readFile(new URL('schema.json',out),'utf8'));
const wb=Workbook.create();
const instructions=wb.worksheets.add('字段说明');
const info=[['薪衡 Compass 演示数据','','','',''],['全部为虚拟数据，仅用于导入与功能测试','','','',''],['2025-01 至 2026-12；150 个员工编号；期末在职 145 人','','','',''],['核心表：organizations、job_grades、employee_monthly、payroll_monthly','','','',''],['金额为税前 CNY；比例用小数；空值表示未提供；零表示实际为零','','','',''],['第一行为标准字段名；不要插入合并标题行；字段类型与必填规则如下','','','',''],['工作表','字段','中文名称','类型','必填']];
for(const [name,table] of Object.entries(schema))for(const [field,def] of Object.entries(table.fields))info.push([name,field,def.label,def.type,def.required?'是':'否']);
instructions.getRange(`A1:E${info.length}`).values=info;
instructions.showGridLines=false;
instructions.getRange(`A1:E${info.length}`).format.font={name:'Microsoft YaHei',size:10,color:'#263f50'};
instructions.getRange('A1:E6').format.rowHeight=25;
instructions.getRange('A1').format.font={size:14,bold:true};
instructions.getRange(`A7:E${info.length}`).format.rowHeight=23;
instructions.getRange(`A1:A${info.length}`).format.columnWidth=27;
instructions.getRange(`B1:B${info.length}`).format.columnWidth=36;
instructions.getRange(`C1:C${info.length}`).format.columnWidth=25;
instructions.getRange(`D1:E${info.length}`).format.columnWidth=15;
instructions.getRange('A7:E7').format={fill:'#173247',font:{color:'#FFFFFF',bold:true},rowHeight:28};
instructions.freezePanes.freezeRows(7);
for(const [key,table] of Object.entries(schema)){
 const sheet=wb.worksheets.add(key); const cols=Object.keys(table.fields); const rows=source[key];
 const matrix=[cols,...rows.map(r=>cols.map(c=>{const v=r[c]??null; return v && table.fields[c].type==='date'?new Date(v+'T00:00:00Z'):v;}))];
 sheet.getRangeByIndexes(0,0,matrix.length,cols.length).values=matrix;
 const used=sheet.getRangeByIndexes(0,0,matrix.length,cols.length);
 used.format.font={name:'Microsoft YaHei',size:10,color:'#263f50'};
 used.format.rowHeight=22;
 sheet.getRangeByIndexes(0,0,1,cols.length).format={fill:'#173247',font:{color:'#FFFFFF',bold:true},rowHeight:30};
 for(let j=0;j<cols.length;j++){
   const col=cols[j],kind=table.fields[col].type;
   const textWidth=Math.max(0,...rows.slice(0,100).map(r=>typeof r[col]==='string'?[...r[col]].reduce((n,ch)=>n+(ch.charCodeAt(0)>255?2:1),0):0));
   sheet.getRangeByIndexes(0,j,matrix.length,1).format.columnWidth=Math.min(65,Math.max(24,col.length*1.05+4,textWidth+5));
   if(kind==='number')sheet.getRangeByIndexes(1,j,rows.length,1).setNumberFormat(col.includes('rate')?'0.0%':'#,##0.00');
   if(kind==='date') {sheet.getRangeByIndexes(1,j,rows.length,1).setNumberFormat('yyyy-mm-dd');sheet.getRangeByIndexes(1,j,rows.length,1).format.horizontalAlignment='left';}
   if(kind==='month')sheet.getRangeByIndexes(1,j,rows.length,1).setNumberFormat('@');
 }
 sheet.showGridLines=false;sheet.freezePanes.freezeRows(1);sheet.freezePanes.freezeColumns(1);
 console.log(key,rows.length);
}
wb.recalculate();
console.log((await wb.inspect({kind:'table',range:'payroll_monthly!A1:F4',tableMaxRows:4,tableMaxCols:6,maxChars:1800})).ndjson);
console.log((await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#NUM!|#NULL!',options:{useRegex:true,maxResults:10},maxChars:500})).ndjson);
await fs.mkdir(new URL('previews/',out),{recursive:true});
for(const key of ['字段说明',...Object.keys(schema)]){
 const preview=await wb.render({sheetName:key,range:key==='字段说明'?'A1:E13':'A1:D6',scale:1,format:'png'});
 await fs.writeFile(new URL(`previews/${key}.png`,out),new Uint8Array(await preview.arrayBuffer()));
}
await(await SpreadsheetFile.exportXlsx(wb)).save(new URL('compass-demo.xlsx',out).pathname.replace(/^\/([A-Z]:)/,'$1'));
console.log('Exported demo workbook.');
