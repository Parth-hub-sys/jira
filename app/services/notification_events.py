import asyncio
import logging
from collections import defaultdict
from collections.abc import AsyncIterator, Collection
from time import time
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession


CHANNEL = "fluztech_notifications"
logger = logging.getLogger(__name__)


async def signal_notifications(db: AsyncSession, recipients: Collection[UUID], operation_id: UUID | None = None) -> None:
    if recipients:
        payload = ",".join(str(user_id) for user_id in recipients)
        if operation_id is not None:
            payload = f"{payload}:{operation_id}"
        await db.execute(
            text("SELECT pg_notify(:channel, :payload)"),
            {"channel": CHANNEL, "payload": payload},
        )


class NotificationEvents:
    def __init__(self):
        self.connected = False
        self.subscribers: dict[str, set[asyncio.Queue[str]]] = defaultdict(set)

    def receive(self, _connection, _pid, _channel, payload: str) -> None:
        recipients, _, operation_id = payload.partition(":")
        event = operation_id or "changed"
        for user_id in recipients.split(","):
            for queue in self.subscribers.get(user_id, ()):
                if queue.empty():
                    queue.put_nowait(event)
                else:
                    previous = queue.get_nowait()
                    queue.put_nowait(previous if previous in (event, "disconnected") else "changed")

    async def listen(self, engine: AsyncEngine) -> None:
        delay = 1
        while True:
            try:
                async with asyncio.timeout(10):
                    connection = await engine.connect()
                try:
                    driver = (await connection.get_raw_connection()).driver_connection
                    disconnected = asyncio.Event()

                    def on_disconnect(_connection):
                        disconnected.set()

                    driver.add_termination_listener(on_disconnect)
                    try:
                        await asyncio.wait_for(driver.add_listener(CHANNEL, self.receive), timeout=10)
                        self.connected = True
                        delay = 1
                        while not disconnected.is_set():
                            try:
                                await asyncio.wait_for(disconnected.wait(), timeout=60)
                            except TimeoutError:
                                await driver.execute("SELECT 1", timeout=5)
                    finally:
                        self.connected = False
                        for queues in self.subscribers.values():
                            for queue in queues:
                                if not queue.empty():
                                    queue.get_nowait()
                                queue.put_nowait("disconnected")
                        driver.remove_termination_listener(on_disconnect)
                        if not driver.is_closed():
                            try:
                                await asyncio.wait_for(driver.remove_listener(CHANNEL, self.receive), timeout=5)
                            except Exception:
                                await connection.invalidate()
                finally:
                    await connection.close()
            except asyncio.CancelledError:
                raise
            except Exception as error:
                logger.warning("Notification listener unavailable (%s)", type(error).__name__)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)

    async def stream(self, user_id: UUID, expires_at: int) -> AsyncIterator[str]:
        if not self.connected or expires_at <= time():
            return
        key = str(user_id)
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=1)
        self.subscribers[key].add(queue)
        try:
            yield "event: ready\ndata: {}\n\n"
            while (remaining := expires_at - time()) > 0:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=min(25, remaining))
                except TimeoutError:
                    if time() < expires_at:
                        yield ": keep-alive\n\n"
                    continue
                if event == "disconnected" or time() >= expires_at:
                    break
                data = "{}" if event == "changed" else event
                yield f"event: changed\ndata: {data}\n\n"
        finally:
            self.subscribers[key].remove(queue)
            if not self.subscribers[key]:
                del self.subscribers[key]
