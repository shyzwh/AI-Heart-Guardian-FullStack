import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 将 AI 返回的 Markdown 文本渲染为格式化 HTML。
 * 统一样式：加粗、列表项目符号、段落间距、代码块背景、表格边框。
 * 不启用原始 HTML，避免注入。
 */
export function MarkdownText({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div
      className={
        'text-sm leading-relaxed text-foreground/90 ' +
        '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 ' +
        '[&_strong]:font-semibold [&_strong]:text-foreground ' +
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 ' +
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 ' +
        '[&_li]:leading-relaxed ' +
        '[&_h1]:mt-3 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold ' +
        '[&_h2]:mt-3 [&_h2]:mb-2 [&_h2]:text-sm [&_h2]:font-semibold ' +
        '[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold ' +
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.8em] [&_code]:text-foreground ' +
        '[&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 ' +
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0 ' +
        '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:bg-muted/40 [&_blockquote]:py-1 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground ' +
        '[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs ' +
        '[&_th]:border [&_th]:border-border [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-medium ' +
        '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 ' +
        '[&_a]:text-primary [&_a]:underline [&_hr]:my-3 [&_hr]:border-border ' +
        className
      }
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
