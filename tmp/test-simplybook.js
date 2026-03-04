import axios from 'axios';
import 'dotenv/config';

function mapToBooking(data) {
    const client = data.client || {};
    const service = data.service || {};
    const provider = data.provider || {};
    const location = data.location || {};

    const fullDate = data.start_datetime || data.start_date || '';
    const [startDate, startTime] = fullDate.split(' ');

    return {
        id: String(data.id),
        balance: '',
        date: startDate,
        time: startTime,
        retouched: false,
        type: String(service.name || data.service_name || ''),
        tariff: String(service.price || data.unit_price || ''),
        deposit: String(service.deposit_price || data.deposit_price || '0'),
        payment: '',
        source: '',
        alreadyBeen: '',
        photoCount: '',
        photographer: String(provider.name || data.performer_name || ''),
        extraPhotographer: '',
        photographerPayment: '',
        publicationAllowed: '',
        paymentMethod: '',
        galleryLink: '',
        clientName: String(client.name || data.client_name || ''),
        phone: String(client.phone || data.client_phone || ''),
        email: String(client.email || data.client_email || ''),
        city: String(location.name || (typeof data.location === 'string' ? data.location : '')),
        status: 'запис оновлено',
    };
}

const loginApiUrl = 'https://user-api-v2.simplybook.me/admin/auth';
const userApiUrl = 'https://user-api-v2.simplybook.me';

async function test() {
    const companyLogin = process.env.SIMPLYBOOK_COMPANY_LOGIN;
    const userLogin = process.env.SIMPLYBOOK_USER_LOGIN;
    const userPassword = process.env.SIMPLYBOOK_USER_PASSWORD;

    console.log('Logging in...');
    const loginResponse = await axios.post(loginApiUrl, {
        company: companyLogin,
        login: userLogin,
        password: userPassword,
    });

    const token = loginResponse.data.token;
    console.log('Token received');

    console.log('Fetching bookings...');
    const bookingsResponse = await axios.get(`${userApiUrl}/admin/bookings`, {
        params: {
            'filter[date_from]': '2026-02-01',
            'filter[date_to]': '2026-02-28',
            'limit': 1
        },
        headers: {
            'X-Company-Login': companyLogin,
            'X-Token': token,
        },
    });

    const rawBooking = bookingsResponse.data.data[0];
    console.log('Raw Booking snippet:', JSON.stringify({
        id: rawBooking.id,
        service: rawBooking.service,
        provider: rawBooking.provider,
        client: rawBooking.client
    }, null, 2));

    const mapped = mapToBooking(rawBooking);
    console.log('Mapped Result:', JSON.stringify(mapped, null, 2));

    // Verify key fields specifically
    console.log('\nVerification Check:');
    console.log('Type (should be from service.name):', mapped.type);
    console.log('Tariff (should be from service.price):', mapped.tariff);
    console.log('Deposit (should be from service.deposit_price):', mapped.deposit);
    console.log('Photographer (should be from provider.name):', mapped.photographer);
}

test().catch(console.error);
