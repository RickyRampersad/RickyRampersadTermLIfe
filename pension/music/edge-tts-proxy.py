"""Teach edge-tts to trust the agent proxy's CA.

The proxy terminates TLS with its own certificate authority. edge-tts builds
its SSL context from certifi's bundle alone and ignores SSL_CERT_FILE, so the
proxy's CA is added to that context here. This ADDS a trusted authority — it
does not turn verification off.
"""
import ssl, certifi, edge_tts.communicate as C

ctx = ssl.create_default_context(cafile=certifi.where())
ctx.load_verify_locations("/root/.ccr/ca-bundle.crt")
C._SSL_CTX = ctx

# Usage:
#   import edge_tts_proxy   # this file, imported before edge_tts is used
#   asyncio.run(edge_tts.Communicate(text, "en-US-AndrewMultilingualNeural",
#                                    rate="-3%").save("line01.mp3"))
#
# Off a proxied network this file is unnecessary — the plain CLI works:
#   edge-tts --voice "en-US-AndrewMultilingualNeural" --rate="-3%" \
#            --text "…" --write-media line01.mp3
