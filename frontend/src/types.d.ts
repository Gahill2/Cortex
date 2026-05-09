export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type User = {
    id: string;
    email: string;
    fullName: string;
    organizationId: string;
};
export type Project = {
    id: string;
    name: string;
    description?: string | null;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
};
export type Task = {
    id: string;
    title: string;
    description?: string | null;
    status: TaskStatus;
    projectId: string;
    assigneeId?: string | null;
    organizationId: string;
    createdAt: string;
    updatedAt: string;
};
