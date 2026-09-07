import { cn } from "@crm/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const MARK =
	"M42.88,448 L490.67,256 L42.88,64 L42.67,213.33 L362.67,256 L42.67,298.67 Z";

const spinnerVariants = cva("shrink-0", {
	variants: {
		size: {
			default: "size-4",
			lg: "size-10",
		},
	},
	defaultVariants: {
		size: "default",
	},
});

function TravelSpinner({
	className,
	size,
	...props
}: React.ComponentProps<"svg"> & VariantProps<typeof spinnerVariants>) {
	return (
		<svg
			data-slot="spinner"
			role="status"
			aria-label="Loading"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="-68 -68 648 648"
			fill="none"
			className={cn(spinnerVariants({ size }), className)}
			{...props}
		>
			<path d={MARK} fill="currentColor" fillOpacity={0.85} />
			<path
				d={MARK}
				transform="translate(266.67 256) scale(1.16) translate(-266.67 -256)"
				stroke="var(--ring)"
				strokeWidth={32}
				strokeLinejoin="round"
				strokeLinecap="round"
				pathLength={100}
				strokeDasharray="40 60"
				className="animate-spinner-trace"
			/>
		</svg>
	);
}

export { TravelSpinner };
