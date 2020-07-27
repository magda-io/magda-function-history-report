import { Transform } from "stream";
import { Event } from "./RegistryEventStream";
import moment from "moment";
import signJwtToken from "./signJwtToken";

const DEFAULT_HIGH_WATER_MARK = 50;

const userNameCache = {} as {
    [key: string]: string;
};

async function getUserName(
    authApiUrl: string,
    userId: string
): Promise<string> {
    if (typeof userNameCache[userId] !== "undefined") {
        return userNameCache[userId];
    }
    const res = await fetch(`${authApiUrl}/public/users/${userId}`);
    if (!res.ok) {
        userNameCache[userId] = "N/A";
    } else {
        userNameCache[userId] = (await res.json())["displayName"];
    }
    return userNameCache[userId];
}

const recordNameCache = {} as {
    [key: string]: string;
};

async function getRecordName(
    registryApiUrl: string,
    recordId: string,
    userId: string | null
): Promise<string> {
    if (typeof recordNameCache[recordId] !== "undefined") {
        return recordNameCache[recordId];
    }
    const jwtToken = userId ? await signJwtToken(userId) : null;
    const res = await fetch(
        `${registryApiUrl}/records/${encodeURIComponent(recordId)}`,
        {
            headers: jwtToken
                ? {
                      "X-Magda-Session": jwtToken
                  }
                : {}
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
    return userNameCache[userId];
}

export const csvHeaders = ["Event id"];

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
                Time: moment(event.eventTime).format("DD/MM/YYYY HH:mm:ss A"),
                "Record Id": event?.data?.recordId,
                "Record Name": await getRecordName(
                    this.registryApiUrl,
                    event?.data?.recordId,
                    this.userId
                ),
                "Event type": event.eventType,
                "Aspect Id": event?.data?.aspectId ? event.data.aspectId : ""
            } as any;

            const jsonData = JSON.stringify(
                event?.data?.aspect ? event.data.aspect : event.data
            );
            const jsonPatch = (event?.data?.path
                ? event.data.path
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
                        "JSON Path Value": p?.value ? p.value : "",
                        "JSON Value": jsonData
                    })
                );
            }
        } catch (e) {
            callback(e);
        }
    }
}