"""Extract source text, retaining order/coverage warnings. No macros, OCR or commands."""
import json, sys, zipfile
from pathlib import Path

def extract(p):
    suffix=p.suffix.lower(); units=[]; issues=[]; parts=[]; offset=0
    def add(label,text):
        nonlocal offset
        parts.append(text); units.append(dict(label=label,start=offset,end=offset+len(text))); offset+=len(text)+2
    if suffix in ('.txt','.md','.srt','.vtt'):
        text=p.read_bytes().decode('utf-8-sig',errors='strict')
        if '\x00' in text: raise ValueError('正文含空字符，需要可读取的 UTF-8 文件')
        add('正文',text)
    elif suffix=='.docx':
        import xml.etree.ElementTree as ET
        with zipfile.ZipFile(p) as z:
            if sum(x.file_size for x in z.infolist())>40_000_000: raise ValueError('Word 解压内容超过限制')
            root=ET.fromstring(z.read('word/document.xml'))
            ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            for i,para in enumerate(root.findall('.//w:body//w:p',ns)):
                add('段落 '+str(i+1),''.join(n.text or '' for n in para.findall('.//w:t',ns)))
            if any('media/' in n or n.endswith(('footnotes.xml','endnotes.xml')) for n in z.namelist()):
                issues.append('Word 含图片或脚注/尾注，需确认这些内容是否属于必读原文；当前只提取正文与表格文字')
    elif suffix=='.pdf':
        from pypdf import PdfReader
        reader=PdfReader(str(p))
        if reader.is_encrypted: raise ValueError('PDF 已加密，需要可读取版本')
        if len(reader.pages)>2000: raise ValueError('PDF 超过 2000 页，请缩小本次改编范围')
        for i,page in enumerate(reader.pages):
            text=page.extract_text() or ''; add('页 '+str(i+1),text)
            if not text.strip(): issues.append('第 '+str(i+1)+' 页无可提取文字，可能为扫描页或空白页')
        issues.append('PDF 阅读顺序需核对；提取成功不代表已完成原作覆盖检查')
    else: raise ValueError('暂不能可靠读取此格式；旧版 Word 请另存为 DOCX，或补充 TXT/Markdown')
    text='\n\n'.join(parts)
    if not text.strip(): issues.append('未取得可读正文')
    if '\ufffd' in text: issues.append('正文含替换字符，可能存在乱码')
    if len(text)>2_000_000: raise ValueError('正文超过 200 万字符，请分批确定本次范围')
    return dict(text=text,units=units,issues=issues,status='needs_material' if any('无可提取' in x or '未取得' in x or '乱码' in x for x in issues) else 'readable')

try: result=extract(Path(sys.argv[1]))
except Exception as e: result=dict(text='',units=[],issues=[str(e)],status='needs_material')
print(json.dumps(result,ensure_ascii=True))
