import dgram from 'node:dgram'
import process from 'node:process'
import { parseXML } from './json/parse-xml.ts'
import { select } from './json/select.ts'
import { toXML } from './json/to-xml.ts'

const routerIp = process.env.ROUTER_IP
if (!routerIp) {
  throw new Error('ROUTER_IP is not defined')
}

const externalIp = await getRouterExternalIpAddress(routerIp)
console.log('External IP:', externalIp)

export async function getRouterExternalIpAddress(routerIp: string, timeoutMs = 5000) {
  const signal = AbortSignal.timeout(timeoutMs)
  const location = await getRouterLocation(routerIp, signal)
  const controlUrl = await getControlUrl(location, signal)
  const externalIpAddress = await getExternalIpAddress(controlUrl, signal)

  return externalIpAddress
}

async function getRouterLocation(routerIp: string, signal: AbortSignal) {
  const port = 1900

  const msg =
    'M-SEARCH * HTTP/1.1\r\n' +
    `HOST: ${routerIp}:${port}\r\n` +
    'MAN: "ssdp:discover"\r\n' +
    'MX: 3\r\n' +
    'ST: urn:schemas-upnp-org:device:InternetGatewayDevice:1\r\n' +
    '\r\n'

  const client = dgram.createSocket('udp4')
  return new Promise<string>((resolve, reject) => {
    const onAbort = () => {
      client.close()
      reject(new Error('Timeout waiting for router response'))
    }

    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) {
      onAbort()
      return
    }

    client.on('error', (err) => {
      signal.removeEventListener('abort', onAbort)
      client.close()
      reject(err)
    })

    client.on('message', (msg) => {
      signal.removeEventListener('abort', onAbort)
      client.close()

      const res = msg.toString()
      const location = /Location: (.*)/i.exec(res)?.[1]
      if (!location) {
        reject(new Error('Failed to get router location'))
        return
      }

      resolve(location)
    })

    client.send(msg, port, routerIp)
  })
}

async function getControlUrl(location: string, signal: AbortSignal) {
  const res = await fetch(location, { signal })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${location}: ${res.statusText}`)
  }

  const xmlText = await res.text()
  const xml = parseXML(xmlText)

  const query = {
    device: {
      deviceType: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
      '..': {
        service: {
          serviceType: [
            'urn:schemas-upnp-org:service:WANIPConnection:1',
            'urn:schemas-upnp-org:service:WANIPConnection:2',
            'urn:schemas-upnp-org:service:WANPPPConnection:1',
          ],
        },
      },
    },
  }

  const service = select(xml, query).find(() => true)
  if (!service) {
    throw new Error('Failed to get WAN service')
  }

  const controlUrl = service.controlURL._
  if (!controlUrl) {
    throw new Error('Failed to get control URL')
  }

  const absoluteControlUrl = new URL(controlUrl, location).toString()

  return absoluteControlUrl
}

async function getExternalIpAddress(controlUrl: string, signal: AbortSignal) {
  const service = 'urn:schemas-upnp-org:service:WANIPConnection:1'

  const body = {
    's:Envelope': {
      $: {
        'xmlns:s': 'http://schemas.xmlsoap.org/soap/envelope/',
        's:encodingStyle': 'http://schemas.xmlsoap.org/soap/encoding/',
      },
      's:Body': {
        'u:GetExternalIPAddress': {
          $: {
            'xmlns:u': service,
          },
        },
      },
    },
  }

  const res = await fetch(controlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      SOAPAction: `"${service}#GetExternalIPAddress"`,
      Connection: 'close',
    },
    body: toXML(body),
    signal,
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch ${controlUrl}: ${res.statusText}`)
  }

  const data = await res.text()

  const ipAddress = /<NewExternalIPAddress>(.*?)<\/NewExternalIPAddress>/.exec(data)?.[1]
  return ipAddress
}
