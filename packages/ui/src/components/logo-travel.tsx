import type * as React from "react";

const MARK =
	"M42.88,448 L490.67,256 L42.88,64 L42.67,213.33 L362.67,256 L42.67,298.67 Z";

const TravelLogo = (props: React.SVGProps<SVGSVGElement>) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={512}
		height={512}
		viewBox="0 0 512 512"
		fill="none"
		aria-label="Travel Logo"
		{...props}
	>
		<path d={MARK} fill="currentColor" />
	</svg>
);
export default TravelLogo;
