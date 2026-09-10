import { writable } from "svelte/store";


/*
|--------------------------------------------------------------------------
| Types
|--------------------------------------------------------------------------
*/

export type NotificationType =
    | "error"
    | "warning"
    | "info"
    | "success";


export interface NotificationAction {

    label: string;

    primary?: boolean;

    onClick: () => void;

}


export interface NotificationOptions {

    description?: string;

    details?: string;

    duration?: number; // ms, 0 = persistent

    actions?: NotificationAction[];

}


export interface NotificationItem {

    id: string;

    type: NotificationType;

    message: string;

    description?: string;

    details?: string;

    duration: number;

    actions?: NotificationAction[];

    timestamp: number;

}


/*
|--------------------------------------------------------------------------
| Store
|--------------------------------------------------------------------------
*/

export const notifications =
    writable<NotificationItem[]>([]);


/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

let idCounter = 0;


function addNotification(
    type: NotificationType,
    message: string,
    options?: NotificationOptions
): string {

    idCounter++;

    const id = `notif-${Date.now()}-${idCounter}`;


    /*
    |--------------------------------------------------------------------------
    | Default Durations:
    | Errors: persistent (0) so users never miss critical issues
    | Warnings: 7000ms
    | Info: 4500ms
    | Success: 3200ms
    |--------------------------------------------------------------------------
    */

    const defaultDuration =
        type === "error"
            ? 0
            : type === "warning"
                ? 7000
                : type === "info"
                    ? 4500
                    : 3200;


    const duration =
        options?.duration !== undefined
            ? options.duration
            : defaultDuration;


    const item: NotificationItem = {

        id,

        type,

        message,

        description:
            options?.description,

        details:
            options?.details,

        duration,

        actions:
            options?.actions,

        timestamp:
            Date.now()

    };


    notifications.update(
        (list) => [...list, item]
    );


    return id;

}


export function dismissNotification(
    id: string
) {

    notifications.update(
        (list) => list.filter((item) => item.id !== id)
    );

}


export function clearAllNotifications() {

    notifications.set([]);

}


/*
|--------------------------------------------------------------------------
| Notify API
|--------------------------------------------------------------------------
*/

export const notify = {

    error: (
        message: string,
        options?: NotificationOptions
    ) => addNotification("error", message, options),


    warning: (
        message: string,
        options?: NotificationOptions
    ) => addNotification("warning", message, options),


    info: (
        message: string,
        options?: NotificationOptions
    ) => addNotification("info", message, options),


    success: (
        message: string,
        options?: NotificationOptions
    ) => addNotification("success", message, options),


    dismiss: dismissNotification,


    clearAll: clearAllNotifications

};
