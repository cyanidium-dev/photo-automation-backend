export const GOOGLE_SHEET_COLUMNS = [
  'ID', // A
  'Залишок', // B
  'Дата фотосесії', // C
  'Година фотосесії', // D
  'Відретушовані фото', // E
  'Тип фотосесії', // F
  'Тариф', // G
  'Завдаток', // H
  'Оплата', // I
  'Звідки дізнались', // J
  'Чи вже були на фотосесії', // K
  'К-ть фото', // L
  'Фотограф', // M
  'Екстра Фотограф', // N
  'Оплата фотографу', // O
  'Публікація чи дозволена', // P
  'Спосіб оплати', // Q
  'Посилання', // R
  'ПІ клієнта', // S
  'Номер телефону', // T
  'Ел пошта', // U
  'Місто', // V
  'Статус та помилки', // W
];

export enum ColumnIndex {
  ID = 0,
  BALANCE = 1,
  DATE = 2,
  TIME = 3,
  RETOUCHED = 4,
  TYPE = 5,
  TARIFF = 6,
  DEPOSIT = 7,
  PAYMENT = 8,
  SOURCE = 9,
  ALREADY_BEEN = 10,
  PHOTO_COUNT = 11,
  PHOTOGRAPHER = 12,
  EXTRA_PHOTOGRAPHER = 13,
  PHOTOGRAPHER_PAYMENT = 14,
  PUBLICATION_ALLOWED = 15,
  PAYMENT_METHOD = 16,
  GALLERY_LINK = 17,
  CLIENT_NAME = 18,
  PHONE = 19,
  EMAIL = 20,
  CITY = 21,
  STATUS = 22,
}
