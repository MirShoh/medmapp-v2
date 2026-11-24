/** Server-rendered schema.org structured data. "<" is escaped so text can never close the script tag. */
export function JsonLd({ data }: { data: object | null | undefined | (object | null | undefined)[] }) {
  const list = (Array.isArray(data) ? data : [data]).filter(Boolean);
  if (!list.length) return null;
  return (
    <>
      {list.map((d, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(d).replace(/</g, "\\u003c") }} />
      ))}
    </>
  );
}
