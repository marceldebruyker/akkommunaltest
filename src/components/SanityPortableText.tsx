import { PortableText } from '@portabletext/react';

// Custom components for Sanity portable text to match the AK Kommunal styling
const components = {
  block: {
    h1: ({ children }: any) => <h1 className="text-4xl font-extrabold text-primary mb-6 mt-12 font-headline">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-3xl font-bold text-primary mb-5 mt-10 font-headline">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-2xl font-bold text-primary mb-4 mt-8 font-headline">{children}</h3>,
    normal: ({ children }: any) => <p className="text-on-surface-variant leading-relaxed max-w-3xl mb-6 font-body text-lg font-light">{children}</p>,
    blockquote: ({ children }: any) => <blockquote className="border-l-4 border-primary pl-4 py-1 bg-primary/5 italic text-primary my-8">{children}</blockquote>,
  },
  list: {
    bullet: ({ children }: any) => <ul className="list-disc pl-6 space-y-2 mb-6 text-on-surface-variant font-body">{children}</ul>,
    number: ({ children }: any) => <ol className="list-decimal pl-6 space-y-2 mb-6 text-on-surface-variant font-body">{children}</ol>,
  },
  marks: {
    link: ({ children, value }: any) => (
      <a href={value.href} className="text-blue-600 hover:text-blue-800 underline transition-colors" target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  },
};

export default function SanityPortableText({ value }: { value: any }) {
  if (!value) return null;
  return (
    <div className="prose prose-lg px-2 lg:px-0">
      <PortableText value={value} components={components} />
    </div>
  );
}
