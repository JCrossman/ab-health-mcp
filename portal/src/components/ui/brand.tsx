"use client";

/**
 * Brand logo — matches the heart-shield icon from www.myaihealth.ca.
 */
export function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "w-7 h-7" : size === "lg" ? "w-10 h-10" : "w-8 h-8";
  const iconDims = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-6 h-6" : "w-5 h-5";

  return (
    <div className={`${dims} rounded-lg bg-[#0277b5] flex items-center justify-center shrink-0`}>
      <svg
        aria-hidden="true"
        className={`${iconDims} text-white`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
        />
      </svg>
    </div>
  );
}

export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={`font-semibold text-foreground ${className}`}>
      MyAI Health
    </span>
  );
}

export function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="bg-clip-text text-transparent"
      style={{
        backgroundImage: "linear-gradient(135deg, #0277b5, #035f8a)",
      }}
    >
      {children}
    </span>
  );
}
