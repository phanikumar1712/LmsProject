import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "../../lib/utils"

const buttonVariants = {
    default: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    destructive: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
    outline: "border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 shadow-sm",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    ghost: "hover:bg-slate-100 hover:text-slate-900 text-slate-600",
    link: "text-indigo-600 underline-offset-4 hover:underline",
}

const sizeVariants = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3 text-xs",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
}

const Button = React.forwardRef(
    ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(
                    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                    buttonVariants[variant],
                    sizeVariants[size],
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
