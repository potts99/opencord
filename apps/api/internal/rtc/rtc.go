// Package rtc provides WebRTC signaling support.
//
// WebRTC signaling is handled via the WebSocket connection.
// See internal/ws/client.go handleRTCEvent for the signaling relay.
//
// RTC events: rtc:join, rtc:offer, rtc:answer, rtc:ice_candidate, rtc:leave
// These are relayed between peers via the WebSocket hub.
package rtc
