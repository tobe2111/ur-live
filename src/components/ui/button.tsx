import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// ⚠️ 이 파일은 shadcn 기본값 그대로였다(2026-08-30 감사). 앱의 실제 버튼은
// 인라인 className 2,606개이고 이 컴포넌트는 15곳뿐이지만, 기본값을 방치하면
// 앞으로 만드는 버튼이 계속 이 값을 물려받는다 — 그래서 여기부터 고친다.
// 변경: rounded-md → rounded-lg(앱 최빈값 179회와 정렬) · transition-colors →
// transform 포함(눌림 반응) · active:scale 추가 · 높이/여백을 앱 리듬에 맞춤.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-[160ms] ease-out active:scale-[0.978] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // 📐 2026-08-30: 크기를 `.ur-btn` 체계(32/40/48px)와 같은 눈금에 맞춘다.
      //   이전엔 h-9/h-10/h-11(36/40/44)로 이 파일에만 있는 눈금이었고, 더 나쁘게는
      //   sm 과 lg 가 **둘 다 `rounded-md`** 라 "큰 버튼이 기본 버튼보다 각진" 역전이 있었다.
      //   이제 sm 8px < default 10px < lg 12px 로 크기와 곡률이 같은 방향으로 간다.
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-12 rounded-[0.75rem] px-7",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
