# TODO: Use a production-ready version of this proxy code to implement r9k.
#       As a performance optimisation, only perform the check if the client asks
#       you to. Malicious clients can exploit that. But the worst they can do is
#       greet someone by saying "sup". If they're clever enough to hack the app
#       like that, they're probably half-decent at holding a conversation
#       anyway.
#
# import asyncio
# import websockets
#
# async def forward(src, dest):
#     async for message in src:
#         print(message)
#         await dest.send(message)
#
# async def proxy(local_ws, path):
#     async with websockets.connect('ws://localhost:5443') as remote_ws:
#         listen_task = asyncio.ensure_future(forward(local_ws, remote_ws))
#         send_task = asyncio.ensure_future(forward(remote_ws, local_ws))
#
#         done, pending = await asyncio.wait(
#             [listen_task, send_task],
#             return_when=asyncio.FIRST_COMPLETED,
#         )
#
#         for task in pending:
#             task.cancel()
#
# start_server = websockets.serve(proxy, 'localhost', 8765)
#
# asyncio.get_event_loop().run_until_complete(start_server)
# asyncio.get_event_loop().run_forever()
