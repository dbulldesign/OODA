/* debug.h — optional logging that never touches the host link.
 *
 * The USB port carries the OODA serial protocol, so human-readable logs must go
 * somewhere else. When DEBUG_LOG is 1 they go to DEBUG_SERIAL (a UART on the
 * TX/RX pads); when 0 every LOG() compiles away to nothing.
 */
#pragma once
#include "config.h"

#if DEBUG_LOG
  #define LOG_BEGIN()  DEBUG_SERIAL.begin(115200, SERIAL_8N1, DEBUG_RX_PIN, DEBUG_TX_PIN)
  #define LOG(...)     DEBUG_SERIAL.printf(__VA_ARGS__)
#else
  #define LOG_BEGIN()  do {} while (0)
  #define LOG(...)     do {} while (0)
#endif
