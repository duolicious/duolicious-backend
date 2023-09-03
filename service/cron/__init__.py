from service.cron.emailnotifications import send_notifications_forever
import asyncio

async def main():
    await asyncio.gather(
        # TODO: Add photo deletion task
        send_notifications_forever(),
    )

if __name__ == '__main__':
    asyncio.run(main())
