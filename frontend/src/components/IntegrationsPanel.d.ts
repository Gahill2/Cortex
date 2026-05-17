export type IntegrationItem = {
    id: string;
    name: string;
    configured: boolean;
    connected: boolean;
    detail?: string;
};
interface Props {
    compact?: boolean;
    onNavigateSettings?: () => void;
}
export declare const IntegrationsPanel: ({ compact, onNavigateSettings }: Props) => import("react/jsx-runtime").JSX.Element;
export {};
