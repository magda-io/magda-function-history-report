import fetch from "isomorphic-fetch";
import { Transform } from "stream";
import { Event } from "./RegistryEventStream";
import signJwtToken from "./signJwtToken";

const DEFAULT_HIGH_WATER_MARK = 50;

const userNameCache = {} as {
    [key: string]: string;
};

async function getUserName(
    authApiUrl: string,
    userId: string
): Promise<string> {
    try {
        if (typeof userNameCache[userId] !== "undefined") {
            return userNameCache[userId];
        }
        const tenantId = process.env.tenantId;
        const headers = {
            "X-Magda-Tenant-Id": tenantId ? tenantId : "0"
        } as any;

        const res = await fetch(`${authApiUrl}/public/users/${userId}`, {
            headers
        });
        if (!res.ok) {
            userNameCache[userId] = "N/A";
        } else {
            userNameCache[userId] = (await res.json())["displayName"];
        }
        return userNameCache[userId];
    } catch (e) {
        return "N/A";
    }
}

const recordNameCache = {} as {
    [key: string]: string;
};

async function getRecordName(
    registryApiUrl: string,
    recordId: string,
    userId: string | null
): Promise<string> {
    try {
        if (typeof recordNameCache[recordId] !== "undefined") {
            return recordNameCache[recordId];
        }
        const jwtToken = userId ? await signJwtToken(userId) : null;

        const tenantId = process.env.tenantId;
        const headers = {
            "X-Magda-Tenant-Id": tenantId ? tenantId : "0"
        } as any;
        if (jwtToken) {
            headers["X-Magda-Session"] = jwtToken;
        }

        const res = await fetch(
            `${registryApiUrl}/records/${encodeURIComponent(recordId)}`,
            {
                headers
            }
        );
        if (!res.ok) {
            recordNameCache[userId] = "N/A";
        } else {
            recordNameCache[userId] = (await res.json())["name"];
            recordNameCache[userId] = recordNameCache[userId]
                ? recordNameCache[userId]
                : "N/A";
        }
        return recordNameCache[userId];
    } catch (e) {
        return "N/A";
    }
}

export default class RegistryEventTransformStream extends Transform {
    private authApiUrl: string;
    private registryApiUrl: string;
    private userId: string | null;

    constructor(options: {
        registryApiUrl: string;
        authApiUrl: string;
        highwaterMark?: number;
        userId: string | null;
    }) {
        const highwaterMark = options.highwaterMark
            ? options.highwaterMark
            : DEFAULT_HIGH_WATER_MARK;
        super({
            readableObjectMode: true,
            writableObjectMode: true,
            readableHighWaterMark: highwaterMark,
            // this transform likely generate more records than input
            writableHighWaterMark: highwaterMark * 2
        });
        this.registryApiUrl = options.registryApiUrl;
        if (!this.registryApiUrl) {
            throw new Error(
                "RegistryEventTransformStream: registryApiUrl cannot be empty!"
            );
        }

        this.authApiUrl = options.authApiUrl;
        if (!this.authApiUrl) {
            throw new Error(
                "RegistryEventTransformStream: authApiUrl cannot be empty!"
            );
        }

        this.userId = options.userId;
    }

    async _transform(
        event: Event,
        encoding: string,
        callback: (e?: Error, data?: Event) => void
    ) {
        try {
            const row = {
                "Event id": event.id,
                "User id": event.userId,
                "User Name": await getUserName(this.authApiUrl, event.userId),
                Time: event.eventTime,
                "Record Id": event?.data?.recordId,
                "Record Name": await getRecordName(
                    this.registryApiUrl,
                    event?.data?.recordId,
                    this.userId
                ),
                "Event type": event.eventType,
                "Aspect Id": event?.data?.aspectId ? event.data.aspectId : ""
            } as any;

            let jsonData: string = "";
            if (
                event.eventType !== "DeleteRecord" &&
                event.eventType !== "DeleteRecordAspect"
            ) {
                jsonData = JSON.stringify(
                    event?.data?.aspect ? event.data.aspect : event.data
                );
            }

            const jsonPatch = (event?.data?.patch
                ? event.data.patch
                : []) as any[];

            if (!jsonPatch.length) {
                this.push({
                    ...row,
                    "JSON Patch Operation": "",
                    "JSON Path": "",
                    "JSON Path Value": "",
                    "JSON Value": jsonData
                });
            } else {
                jsonPatch.forEach(p =>
                    this.push({
                        ...row,
                        "JSON Patch Operation": p?.op ? p.op : "",
                        "JSON Path": p?.path ? p.path : "",
                        "JSON Path Value":
                            typeof p?.value !== "undefined"
                                ? typeof p.value === "string"
                                    ? p.value
                                    : JSON.stringify(p.value)
                                : "",
                        "JSON Value": ""
                    })
                );
            }
            callback();
        } catch (e) {
            callback(e as Error);
        }
    }
}
