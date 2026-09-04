import "@crm/ui/print.css";

export default function PublicQuoteLayout({
	children,
}: LayoutProps<"/q/[token]">) {
	return <div className="min-h-svh bg-muted/30">{children}</div>;
}
