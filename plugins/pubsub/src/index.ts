import { Amplify } from '@aws-amplify/core';
import { generateClient } from '@aws-amplify/api';
import { Plugin, PluginKey, Notification } from "@akord/akord-js";
import { Subscription } from 'rxjs';

const DEV_GQL_API_URL = 'https://7doygkohfjbp7ma6bab5ryxabi.appsync-api.eu-central-1.amazonaws.com/graphql'
const GQL_API_URL = 'https://gkce35zhtvfllkbnc3oy2zs6ty.appsync-api.eu-central-1.amazonaws.com/graphql'

type PubSubParams = {
    action: 'subscribe' | 'unsubscribe'
    filter: object
    next?: (notification: Notification) => Promise<void> | void
    error?: (error: any) => void
}

export class PubSubPlugin implements Plugin {
    key: PluginKey = PluginKey.PUBSUB;
    private active: Map<string, Subscription> = new Map();

    register(env?: 'dev' | 'v2') {
        Amplify.configure({
            API: {
                GraphQL: {
                    endpoint: env === 'dev' ? DEV_GQL_API_URL : GQL_API_URL,
                    region: 'eu-central-1',
                    defaultAuthMode: 'lambda'
                }
            }
        });
        console.log("DEBUG PubSub: Configured ", Amplify.getConfig().API)
        return;
    }
    
    unregister() {
        Array.from(this.active.entries()).forEach(entry => entry[1].unsubscribe())
        this.active = new Map();
        return;
    }

    async use(params: PubSubParams): Promise<void> {
        if (params.action === 'subscribe') {
            const client = generateClient({
                authMode: 'lambda',
                authToken: 'custom'
            });

            if (this.active.has(params.filter.toString())) {
                return;
            }
            console.log("DEBUG PubSub: Subscribing using client ", client)
            console.log("DEBUG PubSub: Filters ", {
                and: [
                    { channels: { contains: 'PUBSUB' } },
                    { ...params.filter }
                ]
            })

            const sub = client.graphql({
                query: onCreateNotification,
                variables: {
                    filter: {
                        and: [
                            { channels: { contains: 'PUBSUB' } },
                            { ...params.filter }
                        ]
                    }
                }
                // @ts-ignore
                }).subscribe({
                    next: async ({ data }) => {
                        const notificationProto = data.onCreateNotification;
                        if (notificationProto && params.next) {
                            await params.next(new Notification(notificationProto));
                        }
                    },
                error: (e) => {
                    if (params.error) {
                        params.error(e);
                    }
                }
            });
            if (sub) {
                this.active.set(params.filter.toString(), sub);
            }
        } else if (params.action === 'unsubscribe') {
            if (params.filter) {
                if (this.active.has(params.filter.toString())) {
                    console.warn("No active subscription with given filter criteria")
                } else {
                    const sub = this.active.get(params.filter.toString())
                    sub.unsubscribe()
                    this.active.delete(params.filter.toString())
                }
            } else {
                Array.from(this.active.entries()).forEach(entry => entry[1].unsubscribe())
                this.active = new Map();
            }
        }
    }
}

const onCreateNotification = /* GraphQL */ `subscription OnCreateNotification(
    $filter: ModelSubscriptionNotificationFilterInput
  ) {
    onCreateNotification(filter: $filter) {
      id
      fromAddress
      toAddress
      toMemberId
      toEmail
      vaultId
      objectId
      objectType
      objectName
      event
      channels
      content
      status
      priority
      activity
      count
      host
      createdAt
      updatedAt
    }
  }
  `
