import { memo, useMemo } from 'react';
import katex from 'katex';
export const Formula = memo(function Formula({ tex, block = false, className = '' }: {
    tex: string;
    block?: boolean;
    className?: string;
}) {
    const html = useMemo(() => katex.renderToString(tex, { throwOnError: false, displayMode: block, trust: false, output: 'htmlAndMathml', strict: 'error' }), [tex, block]);
    return <span className={`formula ${className}`} dangerouslySetInnerHTML={{ __html: html }}/>;
});
