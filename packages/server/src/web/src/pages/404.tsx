import { useTranslation } from 'next-i18next';
import { DefaultContentLayout } from '../components/DefaultContentLayout';

const Page = () => {
    const { t } = useTranslation('common');
    return (
        <DefaultContentLayout>
            <h1>{t('notFound.title')}</h1>
        </DefaultContentLayout>
    );
};

export default Page;
