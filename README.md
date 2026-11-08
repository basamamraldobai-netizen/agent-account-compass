# Wakilio Agent Ledger

اريد كبدايه التركيز على تطوير جزئيه مثل محرك استيراد ملف الاكسل ومطابقه وتحليل بيانات الوكلاء، مع تعيين مرن للأعمدة بحيث يتعامل مع ملفات مختلفة:
1. ملفات تحتوي على عمود الوكيل ومبالغ المدفوع/الواصل والمتبقي والتعامل مع النصوص مثل "لاشي" كقيمة صفر.
2. ملفات يكون اسم الوكيل فيها في الترويسة العلوية المدمجة (مثل ملف خالد عباس) وتطبيق الوكيل على كل الحركات.
3. تفعيل صندوق الاقتراحات لمطابقة ودمج أسماء الوكلاء المتشابهة.
4. عرض كشف حساب تفصيلي وملخص مالي لكل وكيل مع إجمالي الجوازات والواصل والمتبقي، وفق هوية وتصميم نظام WAKILIO المرفق.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wakilio-agent-ledger.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d864016a-556f-4ce2-9662-c9f5ef1e085b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
