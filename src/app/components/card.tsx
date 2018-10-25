import { styled } from '../styles';

const Card = styled.section`
    box-sizing: border-box;

    background-color: ${p => p.theme.mainBackground};
    border: 1px solid ${p => p.theme.containerBorder};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,0.2);

    overflow: hidden;
    position: relative;

    > h1 {
        font-size: ${p => p.theme.headingSize};
        font-weight: bold;
    }
`;

export const LittleCard = styled(Card)`
    padding: 15px;

    > h1 {
        margin-bottom: 15px;
    }
`;

export const BigCard = styled(Card)`
    padding: 30px;

    > h1 {
        text-transform: uppercase;
        text-align: right;
        color: ${p => p.theme.containerWatermark};
        margin-bottom: 30px;
    }
`;