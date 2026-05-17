interface Props {
    service: "spotify" | "gmail" | "mail";
    label?: string;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
}
export declare const ConnectOAuthButton: ({ service, label, className, onClick }: Props) => import("react/jsx-runtime").JSX.Element;
export {};
